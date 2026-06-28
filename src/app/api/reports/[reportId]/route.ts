import { NextResponse } from "next/server";
import { getReport, getVideo, getCampaign } from "@/lib/db";

export async function GET(_req: Request, ctx: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await ctx.params;
  const report = getReport(reportId);
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const video = getVideo(report.videoId);
  const campaign = video ? getCampaign(video.campaignId) : undefined;
  return NextResponse.json({ report, video: video ?? null, campaign: campaign ?? null });
}
