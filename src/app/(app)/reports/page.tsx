import Link from "next/link";
import { ArrowRight, FileVideo, Loader2 } from "lucide-react";
import { listReports, getVideo, getCampaign } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { VideoThumbnail } from "@/components/video-thumbnail";
import { DecisionBadge } from "@/components/badges";
import { jurisdictionLabel } from "@/lib/jurisdictions";

export default function ReportsPage() {
  const reports = listReports();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Compliance reports</h1>
        <p className="text-muted-foreground">Every compliance review, with timestamped evidence and decisions.</p>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
            <FileVideo className="mb-2 h-8 w-8" />
            No reports yet. Run a compliance review from a campaign to populate this list.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {reports.map((r) => {
            const video = getVideo(r.videoId);
            const campaign = video ? getCampaign(video.campaignId) : undefined;
            return (
              <Link key={r.id} href={`/reports/${r.id}`}>
                <Card className="transition-colors hover:border-emerald-300 hover:bg-emerald-50/30">
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                      <VideoThumbnail thumbnailUrl={video?.thumbnailUrl} filePath={video?.filePath} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{video?.filename ?? "(deleted video)"}</div>
                      <div className="text-sm text-muted-foreground">{campaign?.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {r.status === "DONE" ? (
                          r.results.map((res) => (
                            <span key={res.jurisdiction} className="flex items-center gap-1 text-xs">
                              <span className="text-muted-foreground">{jurisdictionLabel(res.jurisdiction)}</span>
                              <DecisionBadge decision={res.decision} />
                            </span>
                          ))
                        ) : r.status === "RUNNING" ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" /> {r.statusDetail ?? "reviewing…"}
                          </span>
                        ) : (
                          <span className="text-xs text-red-600">Failed: {r.statusDetail}</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
