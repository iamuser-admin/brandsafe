import path from "path";
import {
  getVideo,
  updateVideo,
  getCampaign,
  getBrand,
  setBrandIndex,
  getReport,
  updateReport,
} from "./db";
import {
  createBrandIndex,
  uploadVideo,
  waitForIndexing,
  getIndexedVideo,
  embedText,
  getClipEmbeddings,
  pegasusOnBrief,
  analyzeObservation,
  describeVideo,
} from "./twelvelabs";
import { judgeJurisdiction } from "./anthropic";
import { cosine, prefilter } from "./relevance";
import { decide } from "./decision";
import type { Brand, JurisdictionResult } from "./types";
import type { JurisdictionCode } from "./config";

/* ------------------------------------------------------------------ */
/* Lazily create one index per BRAND (guarded against races)           */
/* ------------------------------------------------------------------ */

const indexLocks = new Map<string, Promise<string>>();

async function ensureBrandIndex(brand: Brand): Promise<string> {
  if (brand.tlIndexId) return brand.tlIndexId;
  const inFlight = indexLocks.get(brand.id);
  if (inFlight) return inFlight;

  const p = (async () => {
    const fresh = getBrand(brand.id);
    if (fresh?.tlIndexId) return fresh.tlIndexId;
    const indexId = await createBrandIndex(brand.id);
    setBrandIndex(brand.id, indexId);
    return indexId;
  })();

  indexLocks.set(brand.id, p);
  try {
    return await p;
  } finally {
    indexLocks.delete(brand.id);
  }
}

/* ------------------------------------------------------------------ */
/* Stage 1: index the video, then run the Marengo embeddings PRE-FILTER */
/* (coarse anti-abuse gate — NOT the on-brief verdict).                 */
/* ------------------------------------------------------------------ */

export async function runIndexingAndPrefilter(videoId: string): Promise<void> {
  const video = getVideo(videoId);
  if (!video) return;
  const campaign = getCampaign(video.campaignId);
  if (!campaign) return;
  const brand = getBrand(campaign.brandId);
  if (!brand) return;

  try {
    updateVideo(videoId, { state: "INDEXING", stateDetail: "Creating TwelveLabs index…" });
    const indexId = await ensureBrandIndex(brand);
    updateVideo(videoId, { tlIndexId: indexId, stateDetail: "Uploading to TwelveLabs…" });

    const { taskId, videoId: tlVideoId } = await uploadVideo(indexId, absoluteUploadPath(video.filePath), {
      campaign_id: campaign.id,
      submission_id: videoId,
    });
    updateVideo(videoId, { tlTaskId: taskId, tlVideoId, stateDetail: "Indexing video…" });

    const done = await waitForIndexing(taskId, (status) =>
      updateVideo(videoId, { stateDetail: `Indexing (${status})…` })
    );
    const finalVideoId = done.videoId || tlVideoId;

    const meta = await getIndexedVideo(indexId, finalVideoId);
    updateVideo(videoId, {
      tlVideoId: finalVideoId,
      tlAssetId: meta.assetId,
      hlsUrl: meta.hlsUrl,
      thumbnailUrl: meta.thumbnailUrl,
      durationS: meta.duration,
      state: "PREFILTER_RUNNING",
      stateDetail: "Pre-filtering (Marengo embeddings)…",
    });

    // Coarse relevance gate: does ANY clip resemble the campaign brief?
    const [queryVec, clips] = await Promise.all([
      embedText(campaign.searchQuery),
      getClipEmbeddings(indexId, finalVideoId),
    ]);
    const sims = clips.map((c) => cosine(queryVec, c.vector));
    const { signal, pass } = prefilter(sims);

    updateVideo(videoId, {
      prefilterSignal: signal,
      state: pass ? "PREFILTER_PASS" : "PREFILTER_REJECTED",
      stateDetail: pass
        ? "Passed pre-filter — on-brief verdict runs at compliance review."
        : "Rejected at intake — no part of the video resembles the campaign.",
    });
  } catch (err) {
    console.error("[pipeline] indexing/prefilter failed", err);
    updateVideo(videoId, {
      state: "INDEX_FAILED",
      stateDetail: err instanceof Error ? err.message : "Indexing failed.",
    });
  }
}

/* ------------------------------------------------------------------ */
/* Stage 3: compliance review (perception + judgment + decision)       */
/* ------------------------------------------------------------------ */

export async function runCompliance(reportId: string): Promise<void> {
  const report = getReport(reportId);
  if (!report) return;
  const video = getVideo(report.videoId);
  if (!video || !video.tlVideoId) {
    updateReport(reportId, { status: "FAILED", statusDetail: "Video is not indexed yet." });
    return;
  }
  const campaign = getCampaign(video.campaignId);
  const brand = campaign ? getBrand(campaign.brandId) : undefined;

  try {
    updateReport(reportId, { statusDetail: "Description, perception & on-brief check (Pegasus)…" });
    const [description, observation, relevance] = await Promise.all([
      describeVideo(video.tlAssetId, video.tlVideoId),
      analyzeObservation(video.tlAssetId, video.tlVideoId),
      pegasusOnBrief(video.tlAssetId, video.tlVideoId, {
        brandName: brand?.name ?? "the focal brand",
        productFocus: campaign?.description ?? "",
        adCreativeFocus: campaign?.adCreativeFocus ?? "",
      }),
    ]);
    updateReport(reportId, { description, observation, relevance });

    // Off-brief gate: if Pegasus finds the video not on-brief, halt — no point
    // judging policy compliance on a creative that isn't even about the product.
    if (relevance.label === "off_brief") {
      updateReport(reportId, {
        status: "DONE",
        statusDetail: `Off-brief (${relevance.onBriefPct}% on-brief) — compliance review halted.`,
        results: [],
      });
      return;
    }

    const results: JurisdictionResult[] = [];
    for (const jur of report.jurisdictions as JurisdictionCode[]) {
      updateReport(reportId, { statusDetail: `Judging against ${jur} rules (Sonnet)…` });
      const verdicts = await judgeJurisdiction(observation, jur);
      results.push({ jurisdiction: jur, decision: decide(verdicts), verdicts });
      updateReport(reportId, { results });
    }

    updateReport(reportId, { status: "DONE", statusDetail: null, results });
  } catch (err) {
    console.error("[pipeline] compliance failed", err);
    updateReport(reportId, {
      status: "FAILED",
      statusDetail: err instanceof Error ? err.message : "Compliance review failed.",
    });
  }
}

/* ------------------------------------------------------------------ */
/* Re-judge only: reuse stored Pegasus outputs, re-run the judgment    */
/* ------------------------------------------------------------------ */

/**
 * Re-run ONLY the compliance judgment for an existing report, reusing the
 * Pegasus outputs (description, observation, on-brief) already seeded onto it.
 * The video has not changed, so perception is not re-run. Falls back to the
 * full pipeline if the report has no stored observation to reuse.
 */
export async function runComplianceJudgmentOnly(reportId: string): Promise<void> {
  const report = getReport(reportId);
  if (!report) return;
  // Nothing to reuse → do the full perception + judgment pipeline instead.
  if (!report.observation) return runCompliance(reportId);

  try {
    // Off-brief gate: replicate the halt using the reused on-brief verdict.
    if (report.relevance?.label === "off_brief") {
      updateReport(reportId, {
        status: "DONE",
        statusDetail: `Off-brief (${report.relevance.onBriefPct}% on-brief) — compliance review halted.`,
        results: [],
      });
      return;
    }

    const results: JurisdictionResult[] = [];
    for (const jur of report.jurisdictions as JurisdictionCode[]) {
      updateReport(reportId, { statusDetail: `Re-judging against ${jur} rules (Sonnet)…` });
      const verdicts = await judgeJurisdiction(report.observation, jur);
      results.push({ jurisdiction: jur, decision: decide(verdicts), verdicts });
      updateReport(reportId, { results });
    }

    updateReport(reportId, { status: "DONE", statusDetail: null, results });
  } catch (err) {
    console.error("[pipeline] re-judge failed", err);
    updateReport(reportId, {
      status: "FAILED",
      statusDetail: err instanceof Error ? err.message : "Compliance re-judgment failed.",
    });
  }
}

/** /uploads/<id>.mp4 (public) -> absolute fs path. */
function absoluteUploadPath(publicPath: string): string {
  const fname = publicPath.replace(/^\/uploads\//, "");
  return path.join(process.cwd(), "public", "uploads", fname);
}
