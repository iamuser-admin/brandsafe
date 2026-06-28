import { notFound } from "next/navigation";
import { getCampaign, getBrand, listVideosByCampaign } from "@/lib/db";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CampaignWorkspace } from "./campaign-workspace";

export default async function CampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const campaign = getCampaign(campaignId);
  if (!campaign) notFound();
  const brand = getBrand(campaign.brandId);
  const initialVideos = listVideosByCampaign(campaignId);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Brands", href: "/" },
          { label: brand?.name ?? "Brand", href: `/brands/${campaign.brandId}` },
          { label: campaign.name },
        ]}
      />
      <CampaignWorkspace
        campaign={{
          id: campaign.id,
          name: campaign.name,
          description: campaign.description,
          adCreativeFocus: campaign.adCreativeFocus,
          searchQuery: campaign.searchQuery,
        }}
        initialVideos={initialVideos}
      />
    </div>
  );
}
