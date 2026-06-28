import type { JurisdictionCode } from "./jurisdictions";

export type VideoState =
  | "UPLOADING"
  | "INDEXING"
  | "PREFILTER_RUNNING" // Marengo embeddings pre-filter running
  | "PREFILTER_PASS" // passed the coarse pre-filter → ready for compliance
  | "PREFILTER_REJECTED" // obviously off-brief → rejected at intake
  | "INDEX_FAILED";

/** On-brief label, derived from the Pegasus on-brief % at compliance time. */
export type OnBriefLabel = "on_brief" | "partially_on_brief" | "off_brief";

export type Decision = "APPROVE" | "REVIEW" | "BLOCK";

/** Final user disposition once a compliance review exists. */
export type Disposition = "promoted" | "dropped" | "revision_requested";

export type Severity = "critical" | "high" | "medium" | "low" | "contextual";

export type ActionType = "promote" | "request_revision" | "drop";

export interface Brand {
  id: string;
  name: string;
  logo: string;
  /** One TwelveLabs index per brand; campaigns share it (campaign_id in user-metadata). */
  tlIndexId: string | null;
}

export interface Campaign {
  id: string;
  brandId: string;
  name: string;
  description: string;
  adCreativeFocus: string;
  searchQuery: string;
  tlIndexId: string | null;
}

export interface VideoRecord {
  id: string;
  campaignId: string;
  filename: string;
  filePath: string; // public path e.g. /uploads/<id>.mp4
  durationS: number | null;
  tlIndexId: string | null;
  tlTaskId: string | null;
  tlVideoId: string | null;
  tlAssetId: string | null;
  hlsUrl: string | null;
  thumbnailUrl: string | null;
  state: VideoState;
  stateDetail: string | null;
  /** Marengo pre-filter signal = max clip cosine similarity to the campaign query. */
  prefilterSignal: number | null;
  promoted: boolean;
  /** Set once the user acts on a completed review (promote / drop / request revision). */
  disposition: Disposition | null;
  createdAt: string;
}

/** Pegasus on-brief verdict (the real relevance call, at compliance time). */
export interface RelevanceVerdict {
  onBriefPct: number; // 0-100, share of the video that features the focal brand/product
  label: OnBriefLabel;
  focalProductPresent: boolean;
  ranges: Array<{ timecode: string; focal: boolean; note: string }>;
  rationale: string;
}

/** Pegasus observation JSON (perception layer) — shape from detection-observation-spec.md */
export interface Observation {
  video_summary?: string;
  language_primary?: string;
  product?: { name: string | null; type_cues: string[] };
  claims?: Array<{
    claim_type: string;
    verbatim: string;
    gloss_en: string;
    modality: string;
    timecode: string;
    explicit: boolean;
    confidence: number;
  }>;
  ingredients?: Array<Record<string, unknown>>;
  endorsement?: Record<string, unknown>;
  disclosure?: { ad_label_present: boolean; ad_label_text: string | null };
  content_flags?: Array<{
    type: string;
    modality: string;
    timecode: string;
    description: string;
    intensity: string;
    confidence: number;
  }>;
  off_topic?: { observed: boolean; dominant_unrelated_content: string | null; confidence: number };
  [key: string]: unknown;
}

/** A single rule verdict from the Sonnet judgment layer (per OKF verdict schema). */
export interface Verdict {
  id: string;
  jurisdiction: JurisdictionCode;
  rule_id: string;
  category: string;
  severity: Severity;
  verdict: "fail" | "pass";
  evidence: {
    modality: string;
    timecode: string; // mm:ss-mm:ss
    matched_text: string;
  };
  citation: string;
  explanation: string;
  remediation: string;
  /** Manager accepted this violation's risk → excluded from the decision count. */
  accepted?: boolean;
  acceptReason?: string;
  acceptedAt?: string;
}

export interface JurisdictionResult {
  jurisdiction: JurisdictionCode;
  decision: Decision;
  verdicts: Verdict[];
}

export interface ReportRecord {
  id: string;
  videoId: string;
  description: string | null;
  observation: Observation | null;
  relevance: RelevanceVerdict | null;
  status: "RUNNING" | "DONE" | "FAILED";
  statusDetail: string | null;
  jurisdictions: JurisdictionCode[];
  results: JurisdictionResult[];
  createdAt: string;
}
