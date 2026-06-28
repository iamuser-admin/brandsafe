import path from "path";
import { JURISDICTIONS, type JurisdictionCode } from "./jurisdictions";

export { JURISDICTIONS };
export type { JurisdictionCode };

/** Central config + model constants. Read once on the server. */
export const CONFIG = {
  twelveLabsApiKey: process.env.TWELVELABS_API_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
  // The brand index only needs Marengo (for clip embeddings / the pre-filter).
  marengoModel: process.env.TWELVELABS_MARENGO_MODEL ?? "marengo3.0",
  // Analyze (perception) model. Pegasus 1.5 runs via analyze-by-asset_id — it is
  // NOT enabled on the index, and it does real OCR of on-screen text overlays.
  pegasusModel: process.env.TWELVELABS_PEGASUS_MODEL ?? "pegasus1.5",
  // On-brief LABEL thresholds (Pegasus verdict %, at compliance time).
  relevanceReadyThreshold: Number(process.env.RELEVANCE_READY_THRESHOLD ?? 60),
  relevancePendingThreshold: Number(process.env.RELEVANCE_PENDING_THRESHOLD ?? 35),
  // Marengo embeddings PRE-FILTER (on upload): pass if the top-10%-clip mean
  // cosine similarity to the campaign query clears this bar. Measured signals:
  // legit BoJ creatives land 0.129–0.144, a same-category COMPETITOR cream
  // (sulwhasoo) lands 0.105, off-topic uploads ~0.06–0.073. 0.115 sits in the
  // clean gap so the competitor is rejected at intake while every genuine
  // BoJ video still passes. (Marengo reads visual scene, not brand identity —
  // so the gate is calibrated by signal, not by naming the brand in the query.)
  prefilterThreshold: Number(process.env.RELEVANCE_PREFILTER_THRESHOLD ?? 0.115),
  /** Durable demo state + uploaded files live under data/ (gitignored). */
  dataDir: path.join(process.cwd(), "data"),
  uploadsDir: path.join(process.cwd(), "public", "uploads"),
  okfDir: path.join(process.cwd(), "references", "OKF"),
} as const;

/**
 * DEMO SUPPRESSION: verdicts to drop before they enter a report.
 * Disclosure / ad-label requirements (US R-US-004/006, JP R-JP-007, SG R-SG-006,
 * plus KR R-KR-DISCLOSURE) are suppressed across all four jurisdictions for this
 * demo. Empty both lists to restore full enforcement.
 */
export const SUPPRESSED_VERDICT_CATEGORIES: readonly string[] = ["disclosure"];
/** Suppress by exact rule_id too (covers rules whose category isn't "disclosure"). */
export const SUPPRESSED_VERDICT_RULE_IDS: readonly string[] = ["R-KR-DISCLOSURE"];

export function isSuppressedVerdict(v: { category: string; rule_id: string }): boolean {
  return (
    SUPPRESSED_VERDICT_CATEGORIES.includes(v.category) ||
    SUPPRESSED_VERDICT_RULE_IDS.includes(v.rule_id)
  );
}

export function assertTwelveLabsKey() {
  if (!CONFIG.twelveLabsApiKey) {
    throw new Error(
      "TWELVELABS_API_KEY is not set. Add it to .env to enable indexing, relevance, and perception."
    );
  }
}

export function assertAnthropicKey() {
  if (!CONFIG.anthropicApiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env to enable the compliance judgment layer."
    );
  }
}
