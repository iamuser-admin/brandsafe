/** Client-safe jurisdiction metadata (no node imports). */

export const JURISDICTIONS = [
  { code: "US", label: "United States", file: "us-cosmetics-ad-compliance.md" },
  { code: "KR", label: "South Korea", file: "kr-cosmetics-ad-compliance.md" },
  { code: "JP", label: "Japan", file: "jp-cosmetics-ad-compliance.md" },
  { code: "SG", label: "Singapore", file: "sg-cosmetics-ad-compliance.md" },
] as const;

export type JurisdictionCode = (typeof JURISDICTIONS)[number]["code"];

export function jurisdictionLabel(code: string): string {
  return JURISDICTIONS.find((j) => j.code === code)?.label ?? code;
}
