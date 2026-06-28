import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { CONFIG, assertAnthropicKey, isSuppressedVerdict } from "./config";
import type { JurisdictionCode } from "./config";
import { jurisdictionBundle, sharedDecencyLayer, jurisdictionLabel } from "./okf";
import type { Observation, Verdict } from "./types";

let clientSingleton: Anthropic | null = null;
function client(): Anthropic {
  assertAnthropicKey();
  if (!clientSingleton) clientSingleton = new Anthropic({ apiKey: CONFIG.anthropicApiKey });
  return clientSingleton;
}

/* ------------------------------------------------------------------ */
/* Judgment layer: observation + OKF bundle -> per-jurisdiction verdicts */
/* ------------------------------------------------------------------ */

const VERDICT_TOOL: Anthropic.Tool = {
  name: "report_verdicts",
  description: "Report the list of compliance verdicts (only failing rules) for this jurisdiction.",
  input_schema: {
    type: "object",
    properties: {
      verdicts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            rule_id: { type: "string" },
            category: { type: "string" },
            severity: { type: "string", enum: ["critical", "high", "medium", "low", "contextual"] },
            evidence: {
              type: "object",
              properties: {
                modality: { type: "string" },
                timecode: { type: "string", description: "mm:ss-mm:ss" },
                matched_text: { type: "string" },
              },
              required: ["modality", "timecode", "matched_text"],
            },
            citation: { type: "string" },
            explanation: { type: "string" },
            remediation: { type: "string" },
          },
          required: ["rule_id", "category", "severity", "evidence", "citation", "explanation", "remediation"],
        },
      },
    },
    required: ["verdicts"],
  },
};

const JUDGE_SYSTEM = `You are the COMPLIANCE RESOLVER (judgment layer) for cosmetics video ads.

You receive:
1. A jurisdiction-agnostic OBSERVATION JSON produced by a perception model (TwelveLabs Pegasus). It reports only WHAT IS PRESENT in the video (claims, content flags, endorsement, disclosure, off-topic), with verbatim text, modality, and timecodes.
2. The MARKET RULE BUNDLE for one jurisdiction, plus the SHARED decency/off-topic base layer.

Your job: decide which rules the observations VIOLATE for THIS jurisdiction only.

RULES OF ENGAGEMENT
- Judge strictly against the supplied rule bundle. Map each observation to the rule(s) whose detection_signal it fires (use the bundle's signal->rule map and the ✗/○ examples).
- Emit ONE verdict per genuinely violated rule. Only report FAILS (do not report passes).
- Each verdict must cite the exact rule_id and statutory citation from the bundle, reuse the observation's timecode + modality + verbatim/matched text as evidence, and give a one-sentence explanation and a concrete remediation (prefer the bundle's ○ allowed alternative).
- Do not invent violations not supported by the observations. If nothing is violated, return an empty verdicts array.
- Apply the shared decency/off-topic layer with this market's overlay (severity/threshold/citation).
- SUPPRESSED FOR THIS DEMO: do NOT emit any verdict whose category is "disclosure" (ad-label / influencer-disclosure / stealth-marketing requirements), nor the rule R-KR-DISCLOSURE. Skip those rules entirely, in every jurisdiction.
- Return your answer ONLY by calling the report_verdicts tool.`;

export async function judgeJurisdiction(
  observation: Observation,
  jurisdiction: JurisdictionCode
): Promise<Verdict[]> {
  const userText = [
    `TARGET JURISDICTION: ${jurisdiction} (${jurisdictionLabel(jurisdiction)})`,
    ``,
    `=== OBSERVATION JSON (perception layer output) ===`,
    "```json",
    JSON.stringify(observation, null, 2),
    "```",
    ``,
    `=== MARKET RULE BUNDLE (${jurisdiction}) ===`,
    jurisdictionBundle(jurisdiction),
    ``,
    `=== SHARED DECENCY / OFF-TOPIC BASE LAYER ===`,
    sharedDecencyLayer(),
  ].join("\n");

  const res = await client().messages.create({
    model: CONFIG.anthropicModel,
    max_tokens: 4096,
    system: JUDGE_SYSTEM,
    tools: [VERDICT_TOOL],
    tool_choice: { type: "tool", name: "report_verdicts" },
    messages: [{ role: "user", content: userText }],
  });

  const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) return [];
  const input = toolUse.input as { verdicts?: Array<Omit<Verdict, "id" | "jurisdiction" | "verdict">> };
  return (input.verdicts ?? [])
    // Deterministic safety net: drop suppressed verdicts even if the model emits them.
    .filter((v) => !isSuppressedVerdict(v))
    .map((v) => ({
      ...v,
      id: crypto.randomUUID(),
      jurisdiction,
      verdict: "fail" as const,
    }));
}

/* ------------------------------------------------------------------ */
/* Communication template for the creator (REVIEW / BLOCK / OFF-BRIEF) */
/* ------------------------------------------------------------------ */

export async function draftRevisionTemplate(args: {
  creatorContext: string;
  decisionSummary: string;
  verdicts: Verdict[];
  offBrief?: boolean;
}): Promise<string> {
  const findings = args.offBrief
    ? "The video was filtered as OFF-BRIEF: it does not sufficiently feature the campaign product."
    : args.verdicts
        .map(
          (v) =>
            `- [${v.jurisdiction} ${v.rule_id} · ${v.severity}] ${v.explanation} (evidence ${v.evidence.timecode}, "${v.evidence.matched_text}"). Fix: ${v.remediation}`
        )
        .join("\n");

  const res = await client().messages.create({
    model: CONFIG.anthropicModel,
    max_tokens: 900,
    system:
      "You write concise, friendly, professional outreach from an ads-compliance manager to a social creator. " +
      "Be specific and actionable, reference the timestamps and the fix, keep a collaborative tone, and never be condescending. " +
      "Return only the message body (no subject line unless asked).",
    messages: [
      {
        role: "user",
        content: [
          args.decisionSummary,
          args.creatorContext,
          "",
          "Findings to communicate:",
          findings,
          "",
          "Write a short revision-request email the manager can send to the creator. End with a clear next step.",
        ].join("\n"),
      },
    ],
  });

  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
