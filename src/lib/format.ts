/** Client-safe formatting helpers (no node imports). */

import type { Decision, OnBriefLabel, VideoState } from "./types";

/** Parse "mm:ss" or "hh:mm:ss" into seconds. */
export function parseTimecode(tc: string): number {
  const parts = tc.trim().split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

/** "mm:ss-mm:ss" -> start seconds (for seeking). */
export function timecodeStart(range: string): number {
  return parseTimecode(range.split("-")[0] ?? "0");
}

/** "mm:ss-mm:ss" -> end seconds. Falls back to the start for a single timecode. */
export function timecodeEnd(range: string): number {
  const parts = range.split("-");
  return parseTimecode((parts[1] ?? parts[0]) ?? "0");
}

export function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export const DECISION_STYLE: Record<Decision, { label: string; className: string }> = {
  APPROVE: { label: "Approve", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  REVIEW: { label: "Review", className: "bg-amber-100 text-amber-900 border-amber-200" },
  BLOCK: { label: "Block", className: "bg-red-100 text-red-800 border-red-200" },
};

export const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-amber-100 text-amber-900 border-amber-200",
  low: "bg-slate-100 text-slate-700 border-slate-200",
  contextual: "bg-slate-100 text-slate-700 border-slate-200",
};

export const STATE_META: Record<VideoState, { label: string; className: string }> = {
  UPLOADING: { label: "Uploading", className: "bg-slate-100 text-slate-700 border-slate-200" },
  INDEXING: { label: "Indexing", className: "bg-blue-100 text-blue-800 border-blue-200" },
  PREFILTER_RUNNING: { label: "Pre-filtering", className: "bg-blue-100 text-blue-800 border-blue-200" },
  PREFILTER_PASS: { label: "Ready for compliance", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  PREFILTER_REJECTED: { label: "Rejected at intake", className: "bg-red-100 text-red-800 border-red-200" },
  INDEX_FAILED: { label: "Indexing failed", className: "bg-red-100 text-red-800 border-red-200" },
};

export const ONBRIEF_STYLE: Record<OnBriefLabel, { label: string; className: string }> = {
  on_brief: { label: "On-brief", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  partially_on_brief: { label: "Partially on-brief", className: "bg-amber-100 text-amber-900 border-amber-200" },
  off_brief: { label: "Off-brief", className: "bg-red-100 text-red-800 border-red-200" },
};

export function isProcessing(state: VideoState): boolean {
  return state === "UPLOADING" || state === "INDEXING" || state === "PREFILTER_RUNNING";
}
