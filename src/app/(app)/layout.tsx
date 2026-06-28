import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
