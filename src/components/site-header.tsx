import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { LogoutButton } from "./logout-button";

export function SiteHeader({ user }: { user: string }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            BrandSafe
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Brands
            </Link>
            <Link href="/reports" className="hover:text-foreground">
              Reports
            </Link>
          </nav>
        </div>
        <LogoutButton user={user} />
      </div>
    </header>
  );
}
