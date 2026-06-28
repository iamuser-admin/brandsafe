import { NextResponse } from "next/server";
import crypto from "crypto";
import { getVideo, getCampaign, getReportByVideo, insertAction, updateVideo } from "@/lib/db";
import { draftRevisionTemplate } from "@/lib/anthropic";
import { decisionRationale } from "@/lib/decision";
import { jurisdictionLabel } from "@/lib/okf";
import type { ActionType, Verdict } from "@/lib/types";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { videoId?: string; type?: ActionType };
  const { videoId, type } = body;
  if (!videoId || !type) return NextResponse.json({ error: "videoId and type required" }, { status: 400 });

  const video = getVideo(videoId);
  if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });
  const campaign = getCampaign(video.campaignId);
  const report = getReportByVideo(videoId);

  if (type === "promote") {
    const allApprove =
      report?.status === "DONE" &&
      report.results.length > 0 &&
      report.results.every((r) => r.decision === "APPROVE");
    if (!allApprove) {
      return NextResponse.json(
        {
          error:
            "Every jurisdiction must read APPROVE. Accept the risk on each remaining violation in the report first.",
        },
        { status: 400 }
      );
    }
    updateVideo(videoId, { promoted: true, disposition: "promoted" });
    insertAction({ id: crypto.randomUUID(), videoId, type });
    return NextResponse.json({ ok: true, promoted: true });
  }

  if (type === "drop") {
    updateVideo(videoId, { disposition: "dropped" });
    insertAction({ id: crypto.randomUUID(), videoId, type });
    return NextResponse.json({ ok: true });
  }

  // request_revision -> generate a creator-facing message with Sonnet.
  const offBrief = video.state === "PREFILTER_REJECTED" || report?.relevance?.label === "off_brief";
  const verdicts: Verdict[] = (report?.results ?? []).flatMap((r) => r.verdicts);
  const decisionSummary = offBrief
    ? `The video "${video.filename}" was filtered as OFF-BRIEF for the ${campaign?.name ?? "campaign"}.`
    : `Compliance review of "${video.filename}" for the ${campaign?.name ?? "campaign"} returned: ` +
      (report?.results ?? [])
        .map((r) => `${jurisdictionLabel(r.jurisdiction)} → ${r.decision} (${decisionRationale(r.verdicts)})`)
        .join("; ");

  const template = await draftRevisionTemplate({
    creatorContext: `Campaign brief: ${campaign?.adCreativeFocus ?? ""}`,
    decisionSummary,
    verdicts,
    offBrief,
  });

  updateVideo(videoId, { disposition: "revision_requested" });
  insertAction({ id: crypto.randomUUID(), videoId, type, templateText: template });
  return NextResponse.json({ ok: true, template });
}
