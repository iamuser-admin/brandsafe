import { NextResponse } from "next/server";
import { getCampaign, updateCampaignBrief } from "@/lib/db";

export async function GET(_req: Request, ctx: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await ctx.params;
  const campaign = getCampaign(campaignId);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ campaign });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await ctx.params;
  const campaign = getCampaign(campaignId);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    searchQuery?: string;
    description?: string;
    adCreativeFocus?: string;
  };

  const patch: { searchQuery?: string; description?: string; adCreativeFocus?: string } = {};
  for (const key of ["searchQuery", "description", "adCreativeFocus"] as const) {
    if (typeof body[key] === "string") {
      const v = body[key]!.trim();
      if (!v) return NextResponse.json({ error: `${key} cannot be empty` }, { status: 400 });
      patch[key] = v;
    }
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  updateCampaignBrief(campaignId, patch);
  return NextResponse.json({ ok: true, ...patch });
}
