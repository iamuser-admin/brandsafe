"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, Lightbulb, FileText, ScanSearch, Quote, RotateCcw, Loader2, ShieldCheck, ShieldAlert, History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DecisionBadge, SeverityBadge } from "@/components/badges";
import { VideoActions } from "@/components/video-actions";
import { SegmentLoopDialog } from "@/components/segment-loop-dialog";
import { JurisdictionPicker } from "@/components/jurisdiction-picker";
import { decisionRationale } from "@/lib/decision";
import { ONBRIEF_STYLE } from "@/lib/format";
import { cn } from "@/lib/utils";
import { jurisdictionLabel, type JurisdictionCode } from "@/lib/jurisdictions";
import type { OnBriefLabel, ReportRecord, VideoRecord, Verdict } from "@/lib/types";

function OnBriefBadge({ label }: { label: OnBriefLabel }) {
  const s = ONBRIEF_STYLE[label];
  return (
    <Badge variant="outline" className={cn("font-semibold", s.className)}>
      {s.label}
    </Badge>
  );
}

type Campaign = { id: string; name: string };

export function ReportView({
  report,
  video,
  campaign,
}: {
  report: ReportRecord;
  video: VideoRecord;
  campaign: Campaign | null;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const [loopTc, setLoopTc] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState(false);

  // Re-run modal: jurisdictions pre-selected to the report's current set, editable.
  const [rerunOpen, setRerunOpen] = useState(false);
  const [rerunJurs, setRerunJurs] = useState<JurisdictionCode[]>(report.jurisdictions);

  function openRerun() {
    setRerunJurs(report.jurisdictions);
    setRerunOpen(true);
  }

  // Per-violation accept-the-risk modal
  const [acceptTarget, setAcceptTarget] = useState<Verdict | null>(null);
  const [acceptReason, setAcceptReason] = useState("Allowed range of deviation");
  const [accepting, setAccepting] = useState(false);

  function openAccept(v: Verdict) {
    setAcceptTarget(v);
    setAcceptReason("Allowed range of deviation");
  }

  async function confirmAccept() {
    if (!acceptTarget) return;
    setAccepting(true);
    try {
      const res = await fetch(`/api/reports/${report.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdictId: acceptTarget.id, reason: acceptReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not accept the risk");
        return;
      }
      toast.success("Risk accepted — excluded from the violation count.");
      setAcceptTarget(null);
      router.refresh();
    } finally {
      setAccepting(false);
    }
  }

  async function rerun() {
    if (rerunJurs.length === 0) {
      toast.error("Select at least one jurisdiction.");
      return;
    }
    setRerunning(true);
    try {
      const res = await fetch("/api/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoIds: [video.id], jurisdictions: rerunJurs, reuseObservation: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not re-run");
        return;
      }
      toast.success("Re-running compliance review…");
      setRerunOpen(false);
      router.refresh();
    } finally {
      setRerunning(false);
    }
  }

  function seek(timecode: string) {
    // Open the looping-segment modal focused on just this window.
    setActive(timecode);
    setLoopTc(timecode);
  }

  const offBrief = report.relevance?.label === "off_brief";
  const allApprove =
    report.results.length > 0 && report.results.every((r) => r.decision === "APPROVE");
  const acceptedVerdicts = report.results.flatMap((r) => r.verdicts).filter((v) => v.accepted);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Main column */}
      <div className="space-y-6">
        {/* Player */}
        <Card className="overflow-hidden">
          <div className="bg-black">
            <video ref={videoRef} src={video.filePath} controls className="aspect-video w-full" />
          </div>
          <CardContent className="py-3 text-sm text-muted-foreground">
            <span>Click any timestamp in the evidence to replay just that moment on loop.</span>
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-emerald-600" /> Automated video description
            </CardTitle>
            <CardDescription>Generated by TwelveLabs Pegasus.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {report.description ? (
              <p className="leading-relaxed">{report.description}</p>
            ) : (
              <p className="text-muted-foreground">No description available.</p>
            )}
          </CardContent>
        </Card>

        {/* Campaign relevance (on-brief) — the real verdict, from Pegasus */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ScanSearch className="h-4 w-4 text-emerald-600" /> Campaign relevance (on-brief)
            </CardTitle>
            <CardDescription>
              Pegasus measures how much of the video genuinely features the focal brand/product.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {report.relevance ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <OnBriefBadge label={report.relevance.label} />
                  <span className="text-2xl font-semibold">{report.relevance.onBriefPct}%</span>
                  <span className="text-sm text-muted-foreground">on-brief</span>
                </div>
                {report.relevance.rationale && (
                  <p className="text-sm text-muted-foreground">{report.relevance.rationale}</p>
                )}
                {report.relevance.ranges.length > 0 && (
                  <div className="space-y-1">
                    {report.relevance.ranges.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => seek(r.timecode)}
                        className={`flex w-full items-start gap-2 rounded border px-2 py-1.5 text-left text-sm transition-colors ${
                          active === r.timecode ? "border-emerald-300 bg-emerald-50" : "hover:bg-muted"
                        }`}
                      >
                        <Play className="mt-0.5 h-3 w-3 shrink-0" />
                        <span className="mt-0.5 shrink-0 whitespace-nowrap font-mono text-xs">{r.timecode}</span>
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${
                            r.focal ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {r.focal ? "focal" : "other"}
                        </span>
                        <span className="min-w-0 flex-1 break-words text-muted-foreground">{r.note}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {report.status === "FAILED" ? "Not available." : "Assessing…"}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Per-jurisdiction verdicts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compliance evidence</CardTitle>
            <CardDescription>
              Each jurisdiction is evaluated independently against its national rules.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {report.relevance?.label === "off_brief" ? (
              <div className="rounded-md border border-red-200 bg-red-50/60 p-4 text-sm text-red-800">
                Off-brief — the video is not sufficiently about the campaign product, so the policy
                review was halted. Drop it from the report’s next-step panel.
              </div>
            ) : report.results.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {report.status === "FAILED"
                  ? report.statusDetail ?? "Review failed."
                  : "Review in progress…"}
              </p>
            ) : (
              <Tabs defaultValue={report.results[0].jurisdiction}>
                <TabsList className="flex-wrap">
                  {report.results.map((r) => (
                    <TabsTrigger key={r.jurisdiction} value={r.jurisdiction} className="gap-2">
                      {r.jurisdiction}
                      <DecisionBadge decision={r.decision} />
                    </TabsTrigger>
                  ))}
                </TabsList>
                {report.results.map((r) => (
                  <TabsContent key={r.jurisdiction} value={r.jurisdiction} className="space-y-3 pt-3">
                    <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3">
                      <div>
                        <div className="font-medium">{jurisdictionLabel(r.jurisdiction)}</div>
                        <div className="text-sm text-muted-foreground">{decisionRationale(r.verdicts)}</div>
                      </div>
                      <DecisionBadge decision={r.decision} />
                    </div>
                    {r.verdicts.length === 0 ? (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-4 text-sm text-emerald-800">
                        No violations found for this jurisdiction.
                      </div>
                    ) : (
                      r.verdicts.map((v) => (
                        <VerdictCard key={v.id} verdict={v} onSeek={seek} active={active} onAccept={openAccept} />
                      ))
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </CardContent>
        </Card>

        {/* Compliance history — accepted risks (audit trail) */}
        {acceptedVerdicts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4 text-amber-600" /> Compliance history
              </CardTitle>
              <CardDescription>Risks the manager explicitly accepted, with reasons.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {acceptedVerdicts.map((v) => (
                <div key={v.id} className="rounded-md border bg-amber-50/40 p-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-amber-700" />
                    <Badge variant="secondary" className="font-mono text-xs">
                      {v.jurisdiction} · {v.rule_id}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {v.acceptedAt ? new Date(v.acceptedAt).toLocaleString() : ""}
                    </span>
                  </div>
                  <p className="mt-1">
                    <span className="text-muted-foreground">Reason:</span> {v.acceptReason}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{video.filename}</CardTitle>
            <CardDescription>{campaign?.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <ScanSearch className="h-4 w-4 text-emerald-600" />
              <span className="text-muted-foreground">On-brief:</span>
              {report.relevance ? (
                <>
                  <OnBriefBadge label={report.relevance.label} />
                  <span className="font-medium">{report.relevance.onBriefPct}%</span>
                </>
              ) : (
                <span className="font-medium">—</span>
              )}
            </div>
            <Separator />
            <div className="space-y-1">
              <div className="text-muted-foreground">Per-jurisdiction decisions</div>
              {report.results.map((r) => (
                <div key={r.jurisdiction} className="flex items-center justify-between">
                  <span>{jurisdictionLabel(r.jurisdiction)}</span>
                  <DecisionBadge decision={r.decision} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Next step</CardTitle>
            <CardDescription>
              {offBrief
                ? "Off-brief — drop it from the campaign."
                : allApprove
                  ? "Cleared in every reviewed jurisdiction."
                  : "Accept the risk on each remaining violation in the evidence to make it promotable."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {video.disposition && (
              <div className="rounded-md border bg-muted/40 p-2 text-sm">
                Current status:{" "}
                <span className="font-medium">
                  {video.disposition === "promoted"
                    ? "Promoted to paid ad creative"
                    : video.disposition === "dropped"
                      ? "Dropped"
                      : "Revision requested"}
                </span>
              </div>
            )}
            {report.status === "DONE" ? (
              <VideoActions
                videoId={video.id}
                canPromote={allApprove}
                promoted={video.promoted}
                allowRevision={!offBrief}
                onDone={() => router.refresh()}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Available once the review finishes.</p>
            )}
            {video.disposition !== "promoted" && !offBrief && (
              <>
                <Separator />
                <Button variant="outline" size="sm" onClick={openRerun} disabled={rerunning || report.status === "RUNNING"}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Re-run compliance review
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Looping-segment player — opened by clicking any evidence/relevance timestamp */}
      <SegmentLoopDialog
        open={!!loopTc}
        onOpenChange={(o) => !o && setLoopTc(null)}
        src={video.filePath}
        timecode={loopTc}
        filename={video.filename}
      />

      {/* Re-run modal — adjust which jurisdictions to review */}
      <Dialog open={rerunOpen} onOpenChange={setRerunOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Re-run compliance review</DialogTitle>
            <DialogDescription>
              Pick the jurisdictions to review. The current selection is pre-filled — add or remove any.
            </DialogDescription>
          </DialogHeader>
          <JurisdictionPicker selected={rerunJurs} onChange={setRerunJurs} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRerunOpen(false)} disabled={rerunning}>
              Cancel
            </Button>
            <Button onClick={rerun} disabled={rerunning || rerunJurs.length === 0}>
              {rerunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Re-run {rerunJurs.length > 0 ? `(${rerunJurs.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accept-the-risk reason modal */}
      <Dialog open={!!acceptTarget} onOpenChange={(o) => !o && setAcceptTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" /> Accept the risk
            </DialogTitle>
            <DialogDescription>
              {acceptTarget && (
                <span>
                  {acceptTarget.jurisdiction} · {acceptTarget.rule_id} — {acceptTarget.explanation}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason (logged to compliance history)</label>
            <Textarea
              value={acceptReason}
              onChange={(e) => setAcceptReason(e.target.value)}
              className="min-h-24 text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptTarget(null)} disabled={accepting}>
              Cancel
            </Button>
            <Button onClick={confirmAccept} disabled={accepting || !acceptReason.trim()}>
              {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VerdictCard({
  verdict,
  onSeek,
  active,
  onAccept,
}: {
  verdict: Verdict;
  onSeek: (tc: string) => void;
  active: string | null;
  onAccept: (v: Verdict) => void;
}) {
  const tc = verdict.evidence.timecode;
  return (
    <div className={`rounded-md border p-4 ${verdict.accepted ? "border-amber-200 bg-amber-50/40" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="font-mono">
          {verdict.rule_id}
        </Badge>
        <SeverityBadge severity={verdict.severity} />
        <span className="text-sm text-muted-foreground capitalize">{verdict.category.replace(/_/g, " ")}</span>
        <button
          onClick={() => onSeek(tc)}
          className={`ml-auto flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition-colors ${
            active === tc ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "hover:bg-muted"
          }`}
        >
          <Play className="h-3 w-3" /> {tc}
        </button>
      </div>
      <p className={`mt-2 text-sm ${verdict.accepted ? "text-muted-foreground line-through" : ""}`}>
        {verdict.explanation}
      </p>
      <div className="mt-2 flex items-start gap-2 rounded bg-muted/50 p-2 text-sm">
        <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span>
          <span className="text-muted-foreground">[{verdict.evidence.modality}]</span> &ldquo;
          {verdict.evidence.matched_text}&rdquo;
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{verdict.citation}</p>
      <div className="mt-2 flex items-start gap-2 text-sm text-emerald-800">
        <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{verdict.remediation}</span>
      </div>

      <div className="mt-3 border-t pt-2">
        {verdict.accepted ? (
          <div className="flex items-start gap-2 text-sm text-amber-800">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="font-medium">Risk accepted</span> — {verdict.acceptReason}
              <span className="text-muted-foreground">
                {verdict.acceptedAt ? ` · ${new Date(verdict.acceptedAt).toLocaleString()}` : ""}
              </span>
            </span>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="border-amber-300 text-amber-800 hover:bg-amber-50"
            onClick={() => onAccept(verdict)}
          >
            <ShieldAlert className="h-3.5 w-3.5" /> Accept the risk
          </Button>
        )}
      </div>
    </div>
  );
}
