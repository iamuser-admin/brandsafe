import { NextResponse } from "next/server";
import { getReport, updateReport } from "@/lib/db";
import { decide } from "@/lib/decision";

/** Accept the risk of a single compliance violation (excludes it from the count). */
export async function POST(req: Request, ctx: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await ctx.params;
  const report = getReport(reportId);
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { verdictId?: string; reason?: string };
  const verdictId = body.verdictId;
  const reason = (body.reason ?? "").trim() || "Allowed range of deviation";
  if (!verdictId) return NextResponse.json({ error: "verdictId required" }, { status: 400 });

  let found = false;
  const results = report.results.map((r) => {
    const verdicts = r.verdicts.map((v) => {
      if (v.id === verdictId && !v.accepted) {
        found = true;
        return { ...v, accepted: true, acceptReason: reason, acceptedAt: new Date().toISOString() };
      }
      return v;
    });
    // Recompute this jurisdiction's decision with the accepted violation excluded.
    return { ...r, verdicts, decision: decide(verdicts) };
  });

  if (!found) return NextResponse.json({ error: "Violation not found or already accepted" }, { status: 400 });

  updateReport(reportId, { results });
  return NextResponse.json({ ok: true, results });
}
