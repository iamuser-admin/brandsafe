import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getReport, getVideo, getCampaign } from "@/lib/db";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { ReportView } from "@/components/report-view";
import { AutoRefresh } from "@/components/auto-refresh";

export default async function ReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  const report = getReport(reportId);
  if (!report) notFound();
  const video = getVideo(report.videoId);
  if (!video) notFound();
  const campaign = getCampaign(video.campaignId);

  return (
    <div className="space-y-6">
      <AutoRefresh active={report.status === "RUNNING"} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumbs
          items={[
            { label: "Reports", href: "/reports" },
            { label: video.filename },
          ]}
        />
        {campaign && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/campaigns/${campaign.id}`}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to {campaign.name}
            </Link>
          </Button>
        )}
      </div>
      <ReportView report={report} video={video} campaign={campaign ? { id: campaign.id, name: campaign.name } : null} />
    </div>
  );
}
