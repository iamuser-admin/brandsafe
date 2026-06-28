"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { JURISDICTIONS, type JurisdictionCode } from "@/lib/jurisdictions";

export function JurisdictionPicker({
  selected,
  onChange,
}: {
  selected: JurisdictionCode[];
  onChange: (next: JurisdictionCode[]) => void;
}) {
  function toggle(code: JurisdictionCode) {
    onChange(selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code]);
  }
  return (
    <div className="flex flex-wrap gap-2">
      {JURISDICTIONS.map((j) => {
        const checked = selected.includes(j.code);
        return (
          <div
            key={j.code}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
              checked ? "border-emerald-300 bg-emerald-50" : "bg-background"
            }`}
          >
            <Checkbox id={`jur-${j.code}`} checked={checked} onCheckedChange={() => toggle(j.code)} />
            <label htmlFor={`jur-${j.code}`} className="cursor-pointer select-none font-medium">
              {j.label}
            </label>
            <Link
              href={`/policies/${j.code}`}
              target="_blank"
              className="text-muted-foreground hover:text-foreground"
              title="View the regulation/guidelines"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        );
      })}
    </div>
  );
}
