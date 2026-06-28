import type { Decision, Verdict } from "./types";

/**
 * Deterministic decision layer (runs in code, never in an LLM).
 *
 * Rule = count + severity floor, applied PER JURISDICTION:
 *   - 0 fails                -> APPROVE
 *   - any `critical` fail    -> BLOCK   (severity floor)
 *   - otherwise: 1-3 -> REVIEW, >3 -> BLOCK
 *
 * (A `high` fail forcing >= REVIEW is implied: any fail already yields >= REVIEW.)
 */
/** Accepted-risk violations are excluded from the count and the severity floor. */
function activeFails(verdicts: Verdict[]): Verdict[] {
  return verdicts.filter((v) => v.verdict === "fail" && !v.accepted);
}

export function decide(verdicts: Verdict[]): Decision {
  const fails = activeFails(verdicts);
  if (fails.length === 0) return "APPROVE";
  if (fails.some((v) => v.severity === "critical")) return "BLOCK";
  return fails.length > 3 ? "BLOCK" : "REVIEW";
}

export function decisionRationale(verdicts: Verdict[]): string {
  const fails = activeFails(verdicts);
  const accepted = verdicts.filter((v) => v.verdict === "fail" && v.accepted).length;
  const suffix = accepted > 0 ? ` (${accepted} risk-accepted)` : "";
  if (fails.length === 0)
    return accepted > 0
      ? `All violations risk-accepted${accepted > 1 ? "" : ""} — clears the policy gate${suffix}.`
      : "No violations detected — clears the policy gate.";
  const critical = fails.filter((v) => v.severity === "critical").length;
  if (critical > 0) {
    return `${critical} critical violation${critical > 1 ? "s" : ""} present → BLOCK by severity floor (${fails.length} active)${suffix}.`;
  }
  return fails.length > 3
    ? `${fails.length} active violations (> 3) → BLOCK by count${suffix}.`
    : `${fails.length} active violation${fails.length > 1 ? "s" : ""} (1–3) → REVIEW by count${suffix}.`;
}
