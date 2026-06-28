import { CONFIG } from "./config";
import type { OnBriefLabel } from "./types";

/* ------------------------------------------------------------------ */
/* Stage 1 — Marengo embeddings PRE-FILTER (on upload)                 */
/* ------------------------------------------------------------------ */

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Use the mean of the most-on-brand 10% of clips as the relevance signal. */
const PREFILTER_TOP_FRACTION = 0.1;

/**
 * Coarse anti-abuse gate. The signal is the mean cosine similarity of the
 * *most on-brand* clips (top 10%) — "sustained relevance", not a single lucky
 * frame. A long off-topic video can land one beauty-ish frame near the bar, but
 * its top-10% mean stays low. This is NOT the relevance verdict — that comes
 * from Pegasus at compliance time.
 */
export function prefilter(clipSims: number[]): { signal: number; pass: boolean } {
  if (clipSims.length === 0) return { signal: 0, pass: false };
  const sorted = [...clipSims].sort((a, b) => b - a);
  const k = Math.max(1, Math.ceil(sorted.length * PREFILTER_TOP_FRACTION));
  const signal = sorted.slice(0, k).reduce((a, b) => a + b, 0) / k;
  return { signal, pass: signal >= CONFIG.prefilterThreshold };
}

/* ------------------------------------------------------------------ */
/* Stage 2 — On-brief LABEL from the Pegasus on-brief %                */
/* ------------------------------------------------------------------ */

export function onBriefLabel(pct: number): OnBriefLabel {
  if (pct >= CONFIG.relevanceReadyThreshold) return "on_brief";
  if (pct >= CONFIG.relevancePendingThreshold) return "partially_on_brief";
  return "off_brief";
}
