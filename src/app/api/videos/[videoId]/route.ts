import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { CONFIG } from "@/lib/config";
import { getVideo, deleteVideo } from "@/lib/db";
import { deletePlatformVideo } from "@/lib/twelvelabs";

export async function GET(_req: Request, ctx: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await ctx.params;
  const video = getVideo(videoId);
  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ video });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await ctx.params;
  const video = getVideo(videoId);
  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Best-effort cleanup of the TwelveLabs copy (indexed video + asset) + local file.
  await deletePlatformVideo(video.tlIndexId, video.tlVideoId, video.tlAssetId);
  try {
    const fname = video.filePath.replace(/^\/uploads\//, "");
    fs.rmSync(path.join(CONFIG.uploadsDir, fname), { force: true });
  } catch {
    /* ignore */
  }

  deleteVideo(videoId);
  return NextResponse.json({ ok: true });
}
