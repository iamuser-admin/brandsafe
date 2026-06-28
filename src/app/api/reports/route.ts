import { NextResponse } from "next/server";
import { listReports, getVideo, getCampaign } from "@/lib/db";

export async function GET() {
  const reports = listReports().map((r) => {
    const video = getVideo(r.videoId);
    const campaign = video ? getCampaign(video.campaignId) : undefined;
    return { report: r, video: video ?? null, campaign: campaign ?? null };
  });
  return NextResponse.json({ reports });
}
