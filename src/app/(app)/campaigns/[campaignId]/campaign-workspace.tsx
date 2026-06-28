"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Trash2, Upload, FileVideo, ScanSearch, ArrowRight, Pencil, Check, X, RotateCcw, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { StateBadge, DecisionBadge } from "@/components/badges";
import { VideoThumbnail } from "@/components/video-thumbnail";
import { JurisdictionPicker } from "@/components/jurisdiction-picker";
import { VideoActions } from "@/components/video-actions";
import { isProcessing } from "@/lib/format";
import type { VideoRecord, Decision } from "@/lib/types";
import { JURISDICTIONS, type JurisdictionCode } from "@/lib/jurisdictions";

type ReportSummary = {
  id: string;
  status: "RUNNING" | "DONE" | "FAILED";
  statusDetail: string | null;
  onBriefLabel: "on_brief" | "partially_on_brief" | "off_brief" | null;
  acceptedCount: number;
  results: { jurisdiction: JurisdictionCode; decision: Decision }[];
};

type Campaign = {
  id: string;
  name: string;
  description: string;
  adCreativeFocus: string;
  searchQuery: string;
};

export function CampaignWorkspace({
  campaign,
  initialVideos,
}: {
  campaign: Campaign;
  initialVideos: VideoRecord[];
}) {
  const [videos, setVideos] = useState<VideoRecord[]>(initialVideos);
  const [reports, setReports] = useState<Record<string, ReportSummary>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [jurisdictions, setJurisdictions] = useState<JurisdictionCode[]>([]);
  const [uploading, setUploading] = useState(false);
  const [running, setRunning] = useState(false);
  // Per-video re-run modal
  const [rerunTarget, setRerunTarget] = useState<VideoRecord | null>(null);
  const [rerunJurs, setRerunJurs] = useState<JurisdictionCode[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Editable Marengo pre-filter query
  const [query, setQuery] = useState(campaign.searchQuery);
  const [editingQuery, setEditingQuery] = useState(false);
  const [draftQuery, setDraftQuery] = useState(campaign.searchQuery);
  const [savingQuery, setSavingQuery] = useState(false);

  async function saveQuery() {
    const q = draftQuery.trim();
    if (!q) {
      toast.error("Query cannot be empty");
      return;
    }
    setSavingQuery(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchQuery: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Save failed");
        return;
      }
      setQuery(q);
      setEditingQuery(false);
      toast.success("Pre-filter query saved — applies to the next upload.");
    } finally {
      setSavingQuery(false);
    }
  }

  // Editable campaign brief (feeds the Pegasus on-brief prompt)
  const [adFocus, setAdFocus] = useState(campaign.adCreativeFocus);
  const [desc, setDesc] = useState(campaign.description);
  const [editingBrief, setEditingBrief] = useState(false);
  const [draftAdFocus, setDraftAdFocus] = useState(campaign.adCreativeFocus);
  const [draftDesc, setDraftDesc] = useState(campaign.description);
  const [savingBrief, setSavingBrief] = useState(false);

  async function saveBrief() {
    const af = draftAdFocus.trim();
    const ds = draftDesc.trim();
    if (!af || !ds) {
      toast.error("Brief fields cannot be empty");
      return;
    }
    setSavingBrief(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adCreativeFocus: af, description: ds }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Save failed");
        return;
      }
      setAdFocus(af);
      setDesc(ds);
      setEditingBrief(false);
      toast.success("Campaign brief saved — applies to the next on-brief review.");
    } finally {
      setSavingBrief(false);
    }
  }

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${campaign.id}/videos`, { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { videos: VideoRecord[]; reports: Record<string, ReportSummary> };
    setVideos(data.videos);
    setReports(data.reports ?? {});
  }, [campaign.id]);

  useEffect(() => {
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  async function onUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/api/campaigns/${campaign.id}/videos`, { method: "POST", body: form });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          toast.error(`Upload failed: ${e.error ?? file.name}`);
        } else {
          toast.success(`Uploaded ${file.name} — indexing started`);
        }
      }
      await refresh();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onDelete(v: VideoRecord) {
    if (!confirm(`Delete "${v.filename}"? This removes it from TwelveLabs and the demo.`)) return;
    const res = await fetch(`/api/videos/${v.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Video deleted");
      setSelected((s) => {
        const n = new Set(s);
        n.delete(v.id);
        return n;
      });
      await refresh();
    } else {
      toast.error("Delete failed");
    }
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function runCompliance(ids: string[], jurs: JurisdictionCode[] = jurisdictions, reuseObservation = false) {
    if (ids.length === 0) {
      toast.error("Select at least one ready video.");
      return;
    }
    if (jurs.length === 0) {
      toast.error("Select at least one jurisdiction.");
      return;
    }
    setRunning(true);
    try {
      const res = await fetch("/api/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoIds: ids, jurisdictions: jurs, reuseObservation }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not start review");
      } else {
        toast.success(`Compliance review started for ${data.created.length} video(s)`);
        setSelected(new Set());
        setRerunTarget(null);
        await refresh();
      }
    } finally {
      setRunning(false);
    }
  }

  // Per-video re-run modal — its own jurisdiction selection, independent of the
  // top "Run compliance review" picker. Pre-filled with the video's prior set.
  function openRerun(v: VideoRecord) {
    const prior = reports[v.id]?.results.map((r) => r.jurisdiction) ?? [];
    setRerunJurs(prior.length > 0 ? prior : JURISDICTIONS.map((j) => j.code));
    setRerunTarget(v);
  }

  // ---- 5-bucket segmentation ----
  type Bucket = "PROCESSING" | "DECISION" | "REVIEW" | "APPROVED" | "REJECTED";
  function bucketOf(v: VideoRecord): Bucket {
    const report = reports[v.id];
    if (v.disposition === "promoted") return "APPROVED";
    if (v.disposition === "dropped" || v.disposition === "revision_requested") return "REJECTED";
    if (v.state === "PREFILTER_REJECTED" || v.state === "INDEX_FAILED") return "REJECTED";
    if (v.state === "UPLOADING" || v.state === "INDEXING" || v.state === "PREFILTER_RUNNING") return "PROCESSING";
    if (report?.status === "RUNNING") return "PROCESSING";
    // Off-brief at compliance time → rejected, no decision path.
    if (report?.status === "DONE" && report.onBriefLabel === "off_brief") return "REJECTED";
    if (v.state === "PREFILTER_PASS") return report?.status === "DONE" ? "DECISION" : "REVIEW";
    return "PROCESSING";
  }
  const inBucket = (b: Bucket) => videos.filter((v) => bucketOf(v) === b);
  const reviewable = inBucket("REVIEW");

  const bucketDefs: { key: Bucket; title: string; hint: string }[] = [
    { key: "DECISION", title: "Ready for compliance decision", hint: "Reviewed — promote, request a revision, or drop." },
    { key: "REVIEW", title: "Ready for automated compliance review", hint: "Passed the Marengo pre-filter. Run the compliance review to get the on-brief + policy verdict." },
    { key: "PROCESSING", title: "Processing", hint: "Uploading, indexing, pre-filtering, or reviewing (non-blocking)." },
    { key: "APPROVED", title: "Approved — promoted to ad creative", hint: "Cleared (or risk accepted) and promoted to paid ad creative." },
    { key: "REJECTED", title: "Rejected", hint: "Filtered out, revision requested, dropped, or failed — see the stage on each." },
  ];
  const renderedGroups = bucketDefs.map((g) => ({ ...g, items: inBucket(g.key) })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {/* Brief */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-xl">{campaign.name}</CardTitle>
            {!editingBrief && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 gap-1 text-xs"
                onClick={() => {
                  setDraftAdFocus(adFocus);
                  setDraftDesc(desc);
                  setEditingBrief(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit brief
              </Button>
            )}
          </div>
          {!editingBrief && <CardDescription>{adFocus}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {editingBrief ? (
            <div className="space-y-3 rounded-md border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                These two fields feed the Pegasus on-brief verdict at compliance time.
              </p>
              <div className="space-y-1">
                <label className="text-xs font-medium">Ad-creative focus</label>
                <Textarea
                  value={draftAdFocus}
                  onChange={(e) => setDraftAdFocus(e.target.value)}
                  className="min-h-16 bg-background text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Campaign description</label>
                <Textarea
                  value={draftDesc}
                  onChange={(e) => setDraftDesc(e.target.value)}
                  className="min-h-24 bg-background text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-7 gap-1 text-xs" onClick={saveBrief} disabled={savingBrief}>
                  {savingBrief ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => setEditingBrief(false)}
                  disabled={savingBrief}
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">{desc}</p>
          )}
          <div className="rounded-md border bg-muted/40 p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-medium">
                <ScanSearch className="h-4 w-4 text-emerald-600" /> Marengo pre-filter query
              </div>
              {!editingQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => {
                    setDraftQuery(query);
                    setEditingQuery(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
            </div>

            {editingQuery ? (
              <div className="space-y-2">
                <Textarea
                  value={draftQuery}
                  onChange={(e) => setDraftQuery(e.target.value)}
                  className="min-h-24 bg-background text-sm"
                  placeholder="Describe what an on-brief submission looks like for this campaign…"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" className="h-7 gap-1 text-xs" onClick={saveQuery} disabled={savingQuery}>
                    {savingQuery ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => setEditingQuery(false)}
                    disabled={savingQuery}
                  >
                    <X className="h-3.5 w-3.5" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">&ldquo;{query}&rdquo;</p>
            )}

            <p className="mt-2 text-xs text-muted-foreground">
              On upload, Marengo embeddings screen out obviously-unrelated submissions. The real on-brief
              verdict is produced by Pegasus during the compliance review.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Creator submissions</CardTitle>
              <CardDescription>Upload creator videos. Indexing & on-brief checks run automatically.</CardDescription>
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                multiple
                hidden
                onChange={(e) => onUpload(e.target.files)}
              />
              <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload videos
              </Button>
            </div>
          </div>
        </CardHeader>
        {videos.length === 0 && (
          <CardContent>
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-10 text-center text-muted-foreground">
              <FileVideo className="mb-2 h-8 w-8" />
              No videos yet. Upload a creator submission to begin.
            </div>
          </CardContent>
        )}
      </Card>

      {/* Compliance run bar — jurisdictions drive both batch reviews and per-video re-runs */}
      {videos.some((v) => v.state === "PREFILTER_PASS") && (
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardHeader>
            <CardTitle className="text-base">Run compliance review</CardTitle>
            <CardDescription>
              Pick jurisdictions, then review the ready videos. The same selection is used when you re-run a review
              below. Each jurisdiction is judged independently.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <JurisdictionPicker selected={jurisdictions} onChange={setJurisdictions} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => runCompliance(Array.from(selected))} disabled={running || selected.size === 0}>
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Review selected ({selected.size})
              </Button>
              <Button
                variant="outline"
                onClick={() => runCompliance(reviewable.map((v) => v.id))}
                disabled={running || reviewable.length === 0}
              >
                Review all ready ({reviewable.length})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Video groups (5 buckets) */}
      {renderedGroups.map((g) => (
        <div key={g.key} className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">
              {g.title} <span className="text-muted-foreground">({g.items.length})</span>
            </h2>
            <p className="text-sm text-muted-foreground">{g.hint}</p>
          </div>
          <div className="space-y-3">
            {g.items.map((v) => (
              <VideoRow
                key={v.id}
                video={v}
                bucket={g.key}
                report={reports[v.id]}
                selected={selected.has(v.id)}
                onToggle={() => toggleSelect(v.id)}
                onDelete={() => onDelete(v)}
                onRerun={() => openRerun(v)}
                onActionDone={refresh}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Per-video re-run modal — independent jurisdiction selection */}
      <Dialog open={!!rerunTarget} onOpenChange={(o) => !o && setRerunTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">Re-run compliance review</DialogTitle>
            <DialogDescription>
              {rerunTarget?.filename
                ? `Pick jurisdictions for “${rerunTarget.filename}”. Add or remove any.`
                : "Pick the jurisdictions to review. Add or remove any."}
            </DialogDescription>
          </DialogHeader>
          <JurisdictionPicker selected={rerunJurs} onChange={setRerunJurs} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRerunTarget(null)} disabled={running}>
              Cancel
            </Button>
            <Button
              onClick={() => rerunTarget && runCompliance([rerunTarget.id], rerunJurs, true)}
              disabled={running || rerunJurs.length === 0}
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Re-run {rerunJurs.length > 0 ? `(${rerunJurs.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type Bucket = "PROCESSING" | "DECISION" | "REVIEW" | "APPROVED" | "REJECTED";

function rejectedStage(v: VideoRecord, report?: ReportSummary): string {
  if (v.disposition === "dropped") return "Dropped — compliance rejected";
  if (v.disposition === "revision_requested") return "Revision requested to the creator";
  if (v.state === "PREFILTER_REJECTED") return "Rejected at pre-filter (off-brief)";
  if (v.state === "INDEX_FAILED") return "Indexing failed";
  if (report?.onBriefLabel === "off_brief") return "Off-brief — failed Pegasus on-brief check";
  return "Rejected";
}

function VideoRow({
  video,
  bucket,
  report,
  selected,
  onToggle,
  onDelete,
  onRerun,
  onActionDone,
}: {
  video: VideoRecord;
  bucket: Bucket;
  report?: ReportSummary;
  selected: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onRerun: () => void;
  onActionDone: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const processing = isProcessing(video.state) || report?.status === "RUNNING";
  const selectable = bucket === "REVIEW";
  const reviewed = report?.status === "DONE";
  const canPromote = !!reviewed && report.results.length > 0 && report.results.every((r) => r.decision === "APPROVE");
  // Off-brief (Pegasus halted) — terminal, only droppable.
  const offBriefRejected =
    bucket === "REJECTED" && video.state === "PREFILTER_PASS" && !video.disposition;
  // Re-run is possible for anything that passed the pre-filter, except off-brief.
  const canRerun = video.state === "PREFILTER_PASS" && !offBriefRejected;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-center gap-4">
          {selectable ? (
            <Checkbox checked={selected} onCheckedChange={onToggle} className="shrink-0" />
          ) : (
            <div className="w-4 shrink-0" />
          )}
          <button
            type="button"
            onClick={() => setPlaying(true)}
            title="Play video"
            className="group relative flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded bg-muted transition-opacity hover:opacity-90"
          >
            <VideoThumbnail thumbnailUrl={video.thumbnailUrl} filePath={video.filePath} />
            <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
              <Play className="h-5 w-5 fill-white text-white" />
            </span>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{video.filename}</span>
              {video.disposition === "promoted" && (
                <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-xs font-medium text-white">Paid Ad</span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              {bucket === "REJECTED" ? (
                <span className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                  {rejectedStage(video, report)}
                </span>
              ) : (
                <StateBadge state={video.state} />
              )}
              {bucket === "APPROVED" && (report?.acceptedCount ?? 0) > 0 && (
                <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                  {report!.acceptedCount} risk{report!.acceptedCount > 1 ? "s" : ""} accepted
                </span>
              )}
              {processing && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              {bucket === "REVIEW" && (
                <span className="text-muted-foreground">passed pre-filter · run compliance for the verdict</span>
              )}
              {reviewed &&
                report.results.map((r) => (
                  <span key={r.jurisdiction} className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">{r.jurisdiction}</span>
                    <DecisionBadge decision={r.decision} />
                  </span>
                ))}
              {report?.status === "RUNNING" && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> reviewing…
                </span>
              )}
            </div>
            {video.stateDetail && processing && (
              <p className="mt-1 text-xs text-muted-foreground">{video.stateDetail}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {canRerun && bucket !== "REVIEW" && bucket !== "APPROVED" && (
              <Button variant="outline" size="sm" onClick={onRerun} disabled={report?.status === "RUNNING"}>
                <RotateCcw className="h-3.5 w-3.5" /> Re-run
              </Button>
            )}
            {report && report.status !== "RUNNING" && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/reports/${report.id}`}>
                  Report <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onDelete} title="Delete">
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {/* Decision actions for reviewed videos awaiting a call */}
        {bucket === "DECISION" && (
          <div className="rounded-md border border-dashed bg-muted/30 p-3">
            <VideoActions videoId={video.id} canPromote={canPromote} size="sm" onDone={onActionDone} />
          </div>
        )}

        {/* Off-brief (pre-filter or Pegasus): only allow dropping — no promote/revision/re-run. */}
        {bucket === "REJECTED" && (video.state === "PREFILTER_REJECTED" || offBriefRejected) && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-dashed bg-muted/30 p-3">
            <span className="text-sm text-muted-foreground">Off-brief submission — drop it from the campaign.</span>
            <VideoActions
              videoId={video.id}
              canPromote={false}
              size="sm"
              allowRevision={false}
              onDone={onActionDone}
            />
          </div>
        )}
      </CardContent>

      <Dialog open={playing} onOpenChange={setPlaying}>
        <DialogContent className="max-w-4xl overflow-hidden sm:max-w-4xl">
          <DialogHeader className="min-w-0">
            <DialogTitle className="truncate pr-8">{video.filename}</DialogTitle>
          </DialogHeader>
          {playing && (
            <video
              src={video.filePath}
              controls
              autoPlay
              className="aspect-video w-full min-w-0 max-w-full rounded-md bg-black"
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
