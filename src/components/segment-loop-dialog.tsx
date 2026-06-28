"use client";

import { useEffect, useRef } from "react";
import { Repeat } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { timecodeStart, timecodeEnd, formatSeconds } from "@/lib/format";

/**
 * Plays a single mm:ss-mm:ss window of a video on repeat. The segment loops:
 * once playback reaches the end of the window it jumps back to the start.
 */
export function SegmentLoopDialog({
  open,
  onOpenChange,
  src,
  timecode,
  filename,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  /** The "mm:ss-mm:ss" range to loop. */
  timecode: string | null;
  filename?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const start = timecode ? timecodeStart(timecode) : 0;
  const rawEnd = timecode ? timecodeEnd(timecode) : 0;
  // Guard against zero/negative windows (e.g. a single timecode): loop a short clip.
  const end = rawEnd > start ? rawEnd : start + 4;

  // Start the loop at the window's start whenever the dialog opens / target changes.
  useEffect(() => {
    if (!open || !timecode) return;
    const el = videoRef.current;
    if (!el) return;
    const begin = () => {
      el.currentTime = start;
      el.play().catch(() => {});
    };
    if (el.readyState >= 1) begin();
    else el.addEventListener("loadedmetadata", begin, { once: true });
    return () => el.removeEventListener("loadedmetadata", begin);
  }, [open, timecode, start]);

  function onTimeUpdate() {
    const el = videoRef.current;
    if (!el) return;
    // Loop back to the start once we pass the window (or if the user scrubs before it).
    if (el.currentTime >= end || el.currentTime < start - 0.25) {
      el.currentTime = start;
      el.play().catch(() => {});
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden sm:max-w-3xl">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex items-center gap-2 pr-8">
            <Repeat className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="truncate">
              Looping {timecode}
              {filename ? ` · ${filename}` : ""}
            </span>
          </DialogTitle>
        </DialogHeader>
        {open && timecode && (
          <>
            <video
              ref={videoRef}
              src={src}
              controls
              autoPlay
              onTimeUpdate={onTimeUpdate}
              className="aspect-video w-full min-w-0 max-w-full rounded-md bg-black"
            />
            <p className="text-sm text-muted-foreground">
              Replaying {formatSeconds(start)}–{formatSeconds(end)} on repeat. Close to stop.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
