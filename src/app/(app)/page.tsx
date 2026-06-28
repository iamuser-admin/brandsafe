import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { listBrands, listCampaignsByBrand } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function BrandsPage() {
  const brands = listBrands();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Your brands</h1>
        <p className="text-muted-foreground">Select a brand to review its campaign ad creatives.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {brands.map((brand) => {
          const campaigns = listCampaignsByBrand(brand.id);
          return (
            <Link key={brand.id} href={`/brands/${brand.id}`}>
              <Card className="h-full transition-colors hover:border-emerald-300 hover:bg-emerald-50/30">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-xl">
                        {brand.logo}
                      </div>
                      <div>
                        <CardTitle>{brand.name}</CardTitle>
                        <CardDescription>
                          {campaigns.length} campaign{campaigns.length === 1 ? "" : "s"}
                        </CardDescription>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {campaigns.map((c) => c.name).join(" · ")}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
