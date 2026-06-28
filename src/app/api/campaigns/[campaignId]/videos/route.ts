import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { CONFIG } from "@/lib/config";
import { getCampaign, insertVideo, listVideosByCampaign, getReportByVideo } from "@/lib/db";
import { enqueue } from "@/lib/jobs";
import { runIndexingAndPrefilter } from "@/lib/pipeline";

export async function GET(_req: Request, ctx: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await ctx.params;
  const videos = listVideosByCampaign(campaignId);
  const reports = Object.fromEntries(
    videos
      .map((v) => {
        const r = getReportByVideo(v.id);
        if (!r) return null;
        return [
          v.id,
          {
            id: r.id,
            status: r.status,
            statusDetail: r.statusDetail,
            onBriefLabel: r.relevance?.label ?? null,
            acceptedCount: r.results.reduce(
              (n, x) => n + x.verdicts.filter((vd) => vd.accepted).length,
              0
            ),
            results: r.results.map((x) => ({ jurisdiction: x.jurisdiction, decision: x.decision })),
          },
        ] as const;
      })
      .filter(Boolean) as [string, unknown][]
  );
  return NextResponse.json({ videos, reports });
}

export async function POST(req: Request, ctx: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await ctx.params;
  const campaign = getCampaign(campaignId);
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const ext = path.extname(file.name) || ".mp4";
  const storedName = `${id}${ext}`;
  fs.mkdirSync(CONFIG.uploadsDir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(CONFIG.uploadsDir, storedName), buf);

  insertVideo({
    id,
    campaignId,
    filename: file.name,
    filePath: `/uploads/${storedName}`,
    state: "INDEXING",
  });

  // Non-blocking: index + Marengo pre-filter run in the background.
  enqueue(`index:${id}`, () => runIndexingAndPrefilter(id));

  return NextResponse.json({ id });
}
