import fs from "fs";
import { TwelveLabs } from "twelvelabs-js";
import { CONFIG, assertTwelveLabsKey } from "./config";
import { pegasusObservationPrompt } from "./okf";
import type { Observation, OnBriefLabel, RelevanceVerdict } from "./types";
import { extractJson } from "./json";

function onBriefLabel(pct: number): OnBriefLabel {
  if (pct >= CONFIG.relevanceReadyThreshold) return "on_brief";
  if (pct >= CONFIG.relevancePendingThreshold) return "partially_on_brief";
  return "off_brief";
}

let clientSingleton: TwelveLabs | null = null;
function client(): TwelveLabs {
  assertTwelveLabsKey();
  if (!clientSingleton) clientSingleton = new TwelveLabs({ apiKey: CONFIG.twelveLabsApiKey });
  return clientSingleton;
}

/* ------------------------------------------------------------------ */
/* Index (one per BRAND): Marengo 3.0 only.                            */
/* The index is used solely for Marengo clip embeddings (the on-upload */
/* pre-filter). Pegasus runs via analyze-by-asset_id, which is         */
/* independent of the index's models — so no Pegasus model is enabled  */
/* here. Campaigns share the brand index; campaign_id lives in         */
/* user-metadata so the brand can later search across campaigns.       */
/* ------------------------------------------------------------------ */

export async function createBrandIndex(name: string): Promise<string> {
  const res = await client().indexes.create({
    indexName: `brandsafe-${name}-${Date.now()}`.slice(0, 60),
    models: [{ modelName: CONFIG.marengoModel, modelOptions: ["visual", "audio"] }],
    addons: ["thumbnail"],
  });
  if (!res.id) throw new Error("TwelveLabs did not return an index id");
  return res.id;
}

/* ------------------------------------------------------------------ */
/* Upload + index a video                                              */
/* ------------------------------------------------------------------ */

export async function uploadVideo(
  indexId: string,
  filePath: string,
  userMetadata?: Record<string, string>
): Promise<{ taskId: string; videoId: string }> {
  const task = await client().tasks.create({
    indexId,
    videoFile: fs.createReadStream(filePath),
    enableVideoStream: true,
    // Tags every video with campaign_id + submission_id for cross-campaign search.
    ...(userMetadata ? { userMetadata: JSON.stringify(userMetadata) } : {}),
  });
  if (!task.id) throw new Error("TwelveLabs did not return a task id");
  return { taskId: task.id, videoId: task.videoId ?? "" };
}

export async function waitForIndexing(
  taskId: string,
  onProgress?: (status: string) => void
): Promise<{ videoId: string; status: string }> {
  // Poll manually so we can surface progress; ~12.5 min ceiling (150 * 5s).
  for (let i = 0; i < 150; i++) {
    const t = await client().tasks.retrieve(taskId);
    if (onProgress && t.status) onProgress(t.status);
    if (t.status === "ready") return { videoId: t.videoId ?? "", status: "ready" };
    if (t.status === "failed") throw new Error(`Indexing failed for task ${taskId}`);
    await sleep(5000);
  }
  throw new Error(`Indexing timed out for task ${taskId}`);
}

/** Fetch asset id, HLS url, thumbnail, and duration for an indexed video. */
export async function getIndexedVideo(
  indexId: string,
  videoId: string
): Promise<{ assetId: string | null; hlsUrl: string | null; thumbnailUrl: string | null; duration: number | null }> {
  const v = await client().indexes.videos.retrieve(indexId, videoId);
  const sysMeta = (v.systemMetadata ?? {}) as Record<string, unknown>;
  const duration =
    typeof sysMeta.duration === "number" ? (sysMeta.duration as number) : null;
  return {
    assetId: v.assetId ?? null,
    hlsUrl: v.hls?.videoUrl ?? null,
    thumbnailUrl: v.hls?.thumbnailUrls?.[0] ?? null,
    duration,
  };
}

/* ------------------------------------------------------------------ */
/* Stage 1 — Marengo embeddings PRE-FILTER (on upload)                 */
/* Per-clip cosine similarity of the campaign query vs the video's     */
/* Marengo clip embeddings. Marengo 3.0 returns no search score, so we */
/* derive a relevance signal from embeddings instead.                  */
/* ------------------------------------------------------------------ */

export async function embedText(text: string): Promise<number[]> {
  const res = await client().embed.create({ modelName: CONFIG.marengoModel, text });
  const seg = res.textEmbedding?.segments?.[0];
  if (!seg?.float) throw new Error("TwelveLabs returned no text embedding");
  return seg.float;
}

export async function getClipEmbeddings(
  indexId: string,
  videoId: string
): Promise<Array<{ start: number; end: number; vector: number[] }>> {
  const v = await client().indexes.videos.retrieve(indexId, videoId, { embeddingOption: "visual" });
  const segments = v.embedding?.videoEmbedding?.segments ?? [];
  return segments
    .filter((s) => Array.isArray(s.float))
    .map((s) => ({
      start: s.startOffsetSec ?? 0,
      end: s.endOffsetSec ?? 0,
      vector: s.float as number[],
    }));
}

/* ------------------------------------------------------------------ */
/* Stage 2 — Pegasus on-brief verdict (at compliance time)             */
/* ------------------------------------------------------------------ */

export async function pegasusOnBrief(
  assetId: string | null,
  videoId: string,
  campaign: { brandName: string; productFocus: string; adCreativeFocus: string }
): Promise<RelevanceVerdict> {
  const prompt = [
    "You are assessing CAMPAIGN RELEVANCE (on-brief) for a paid ad creative.",
    `FOCAL BRAND: ${campaign.brandName}.`,
    `FOCAL PRODUCT / CAMPAIGN: ${campaign.productFocus}`,
    `EXPECTED CREATIVE: ${campaign.adCreativeFocus} (GRWM, tutorial, or product introduction).`,
    "",
    "The creative is ON-BRIEF only while the creator features, uses, applies, or genuinely",
    "discusses the FOCAL brand's product. Time spent on OTHER brands/products, unrelated talk,",
    "intros/outros, or filler is OFF-brief. Watch the entire video across visuals, speech and",
    "on-screen text.",
    "",
    "Return STRICT JSON only, no prose:",
    "{",
    '  "on_brief_pct": <integer 0-100, share of the total video duration that is on-brief>,',
    '  "focal_product_present": <true|false>,',
    '  "ranges": [ { "timecode": "mm:ss-mm:ss", "focal": <true|false>, "note": "<short factual note>" } ],',
    '  "rationale": "<=2 sentences explaining the percentage>"',
    "}",
  ].join("\n");

  const res = await client().analyze({
    ...analyzeTarget(assetId, videoId),
    prompt,
    temperature: 0.2,
    maxTokens: 1500,
  });
  const parsed = extractJson<{
    on_brief_pct?: number;
    focal_product_present?: boolean;
    ranges?: Array<{ timecode: string; focal: boolean; note: string }>;
    rationale?: string;
  }>(res.data ?? "");

  const pct = Math.max(0, Math.min(100, Math.round(parsed.on_brief_pct ?? 0)));
  return {
    onBriefPct: pct,
    label: onBriefLabel(pct),
    focalProductPresent: !!parsed.focal_product_present,
    ranges: Array.isArray(parsed.ranges) ? parsed.ranges : [],
    rationale: parsed.rationale ?? "",
  };
}

/* ------------------------------------------------------------------ */
/* Pegasus 1.5 — perception (observation JSON) + description           */
/* ------------------------------------------------------------------ */

type AnalyzeTarget =
  | { modelName: "pegasus1.5"; video: { type: "asset_id"; assetId: string } }
  | { modelName: "pegasus1.2"; videoId: string };

function analyzeTarget(assetId: string | null, videoId: string): AnalyzeTarget {
  // Pegasus 1.5 takes a `video` source (asset_id); pegasus1.2 takes `videoId`.
  if (CONFIG.pegasusModel === "pegasus1.5" && assetId) {
    return { modelName: "pegasus1.5", video: { type: "asset_id", assetId } };
  }
  return { modelName: "pegasus1.2", videoId };
}

export async function analyzeObservation(assetId: string | null, videoId: string): Promise<Observation> {
  const res = await client().analyze({
    ...analyzeTarget(assetId, videoId),
    prompt: pegasusObservationPrompt(),
    temperature: 0.2,
    maxTokens: 4096,
  });
  const text = res.data ?? "";
  return extractJson<Observation>(text);
}

export async function describeVideo(assetId: string | null, videoId: string): Promise<string> {
  const res = await client().analyze({
    ...analyzeTarget(assetId, videoId),
    prompt:
      "Describe what happens in this video in 3 to 5 plain sentences for an ad-compliance reviewer. " +
      "Cover the product shown, what the creator does and says, on-screen text, and the overall vibe. " +
      "Do not judge compliance. Return only the description text.",
    temperature: 0.3,
    maxTokens: 600,
  });
  return (res.data ?? "").trim();
}

/**
 * Remove a submission from TwelveLabs. Videos uploaded via tasks.create are
 * asset-backed and cannot be removed with indexes.videos.delete (409
 * task_cannot_be_deleted). Deleting the ASSET with force:true removes the asset
 * and every linked indexed resource (the video) in one call.
 */
export async function deletePlatformVideo(
  indexId: string | null,
  videoId: string | null,
  assetId: string | null
): Promise<void> {
  if (assetId) {
    try {
      await client().assets.delete(assetId, { force: true });
      return;
    } catch (err) {
      console.error("[twelvelabs] delete asset (force) failed, trying video delete", err);
    }
  }
  // Fallback for non-asset-backed / legacy videos.
  if (indexId && videoId) {
    try {
      await client().indexes.videos.delete(indexId, videoId);
    } catch (err) {
      console.error("[twelvelabs] delete indexed video failed (ignored)", err);
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
