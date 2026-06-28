import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { JURISDICTIONS, jurisdictionLabel, type JurisdictionCode } from "@/lib/jurisdictions";
import { jurisdictionMarkdown } from "@/lib/okf";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardContent } from "@/components/ui/card";

export default async function PolicyPage({ params }: { params: Promise<{ jurisdiction: string }> }) {
  const { jurisdiction } = await params;
  const code = jurisdiction.toUpperCase() as JurisdictionCode;
  if (!JURISDICTIONS.some((j) => j.code === code)) notFound();

  const markdown = jurisdictionMarkdown(code);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Reports", href: "/reports" }, { label: `${jurisdictionLabel(code)} policy` }]} />
      <div>
        <h1 className="text-2xl font-semibold">{jurisdictionLabel(code)} — Cosmetics Ad Compliance</h1>
        <p className="text-muted-foreground">
          The national rule bundle (Google OKF) loaded into the compliance judgment layer for this market.
        </p>
      </div>
      <Card>
        <CardContent className="py-6">
          <article className="prose prose-sm prose-neutral max-w-none prose-headings:scroll-mt-20 prose-table:text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </article>
        </CardContent>
      </Card>
    </div>
  );
}
