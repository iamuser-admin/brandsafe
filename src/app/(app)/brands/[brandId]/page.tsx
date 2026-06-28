import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Megaphone } from "lucide-react";
import { getBrand, listCampaignsByBrand, listVideosByCampaign } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/breadcrumbs";

export default async function BrandPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const brand = getBrand(brandId);
  if (!brand) notFound();
  const campaigns = listCampaignsByBrand(brandId);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Brands", href: "/" }, { label: brand.name }]} />
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-2xl">{brand.logo}</div>
        <div>
          <h1 className="text-2xl font-semibold">{brand.name}</h1>
          <p className="text-muted-foreground">Campaigns</p>
        </div>
      </div>
      <div className="grid gap-4">
        {campaigns.map((c) => {
          const videos = listVideosByCampaign(c.id);
          return (
            <Link key={c.id} href={`/campaigns/${c.id}`}>
              <Card className="transition-colors hover:border-emerald-300 hover:bg-emerald-50/30">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Megaphone className="mt-0.5 h-5 w-5 text-emerald-600" />
                      <div>
                        <CardTitle>{c.name}</CardTitle>
                        <CardDescription className="mt-1">{c.adCreativeFocus}</CardDescription>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {videos.length} creator video{videos.length === 1 ? "" : "s"} submitted
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
