import fs from "fs";
import path from "path";
import { CONFIG, JURISDICTIONS } from "./config";
import type { JurisdictionCode } from "./config";

let detectionSpecCache: string | null = null;
let sharedDecencyCache: string | null = null;
const bundleCache = new Map<JurisdictionCode, string>();

function read(file: string): string {
  return fs.readFileSync(path.join(CONFIG.okfDir, file), "utf8");
}

/** The Pegasus observation prompt + schema (jurisdiction-agnostic perception layer). */
export function detectionSpec(): string {
  if (!detectionSpecCache) detectionSpecCache = read("detection-observation-spec.md");
  return detectionSpecCache;
}

/** Shared decency / off-topic base layer applied in every market. */
export function sharedDecencyLayer(): string {
  if (!sharedDecencyCache) sharedDecencyCache = read("shared-decency-language-universal.md");
  return sharedDecencyCache;
}

/** The market rule bundle for one jurisdiction. */
export function jurisdictionBundle(code: JurisdictionCode): string {
  const cached = bundleCache.get(code);
  if (cached) return cached;
  const meta = JURISDICTIONS.find((j) => j.code === code);
  if (!meta) throw new Error(`Unknown jurisdiction: ${code}`);
  const text = read(meta.file);
  bundleCache.set(code, text);
  return text;
}

/** Extract the copy-paste Pegasus prompt from the detection spec (the ```text block). */
export function pegasusObservationPrompt(): string {
  const spec = detectionSpec();
  const match = spec.match(/## The Pegasus prompt[\s\S]*?```text\n([\s\S]*?)```/);
  if (match) return match[1].trim();
  // Fallback: hand the whole spec to the model.
  return spec;
}

export function jurisdictionLabel(code: string): string {
  return JURISDICTIONS.find((j) => j.code === code)?.label ?? code;
}

export function jurisdictionMarkdown(code: JurisdictionCode): string {
  return jurisdictionBundle(code);
}
