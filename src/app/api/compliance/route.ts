import { NextResponse } from "next/server";
import crypto from "crypto";
import { getVideo, getReportByVideo, insertReport, updateReport, updateVideo } from "@/lib/db";
import { enqueue } from "@/lib/jobs";
import { runCompliance, runComplianceJudgmentOnly } from "@/lib/pipeline";
import { JURISDICTIONS, type JurisdictionCode } from "@/lib/config";

const VALID = new Set(JURISDICTIONS.map((j) => j.code));

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    videoIds?: string[];
    jurisdictions?: string[];
    /** Re-run only the judgment, reusing the prior report's Pegasus outputs. */
    reuseObservation?: boolean;
  };
  const videoIds = body.videoIds ?? [];
  const jurisdictions = (body.jurisdictions ?? []).filter((j) => VALID.has(j as JurisdictionCode)) as JurisdictionCode[];
  const reuse = body.reuseObservation === true;

  if (!videoIds.length) return NextResponse.json({ error: "No videos selected" }, { status: 400 });
  if (!jurisdictions.length) return NextResponse.json({ error: "No jurisdictions selected" }, { status: 400 });

  const created: { videoId: string; reportId: string }[] = [];
  for (const videoId of videoIds) {
    const video = getVideo(videoId);
    if (!video || !video.tlVideoId) continue;

    // Grab the prior report BEFORE inserting the new one (else the new empty
    // report would be the "latest" and we'd reuse nothing).
    const prior = reuse ? getReportByVideo(videoId) : undefined;

    // (Re-)running a review resets any prior promote/drop/revision decision.
    updateVideo(videoId, { disposition: null, promoted: false });

    const reportId = crypto.randomUUID();
    insertReport({ id: reportId, videoId, jurisdictions });

    if (reuse && prior?.observation) {
      // Seed the new report with the prior Pegasus outputs and only re-judge.
      updateReport(reportId, {
        description: prior.description,
        observation: prior.observation,
        relevance: prior.relevance,
      });
      enqueue(`compliance:${reportId}`, () => runComplianceJudgmentOnly(reportId));
    } else {
      enqueue(`compliance:${reportId}`, () => runCompliance(reportId));
    }
    created.push({ videoId, reportId });
  }

  return NextResponse.json({ created });
}
