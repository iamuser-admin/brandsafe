import { FileVideo } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Video thumbnail with a reliable fallback chain:
 *   1. TwelveLabs-generated thumbnail (when the addon finished in time)
 *   2. the local video file's first frame (always available — we host the upload)
 *   3. a generic file-video icon (no playable source at all)
 */
export function VideoThumbnail({
  thumbnailUrl,
  filePath,
  className,
}: {
  thumbnailUrl?: string | null;
  filePath?: string | null;
  className?: string;
}) {
  if (thumbnailUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={thumbnailUrl} alt="" className={cn("h-full w-full object-cover", className)} />;
  }
  if (filePath) {
    return (
      <video
        // #t=0.1 nudges the browser to paint an early frame as a static poster.
        src={`${filePath}#t=0.1`}
        preload="metadata"
        muted
        playsInline
        tabIndex={-1}
        className={cn("pointer-events-none h-full w-full object-cover", className)}
      />
    );
  }
  return <FileVideo className="h-6 w-6 text-muted-foreground" />;
}
