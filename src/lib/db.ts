import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import {
  CONFIG,
  SUPPRESSED_VERDICT_CATEGORIES,
  SUPPRESSED_VERDICT_RULE_IDS,
  isSuppressedVerdict,
} from "./config";
import { decide } from "./decision";
import type {
  Brand,
  Campaign,
  VideoRecord,
  VideoState,
  ReportRecord,
  JurisdictionResult,
  RelevanceVerdict,
  Observation,
  ActionType,
} from "./types";
import type { JurisdictionCode } from "./config";

/** Brand/product-specific Marengo pre-filter queries — kept in sync on startup.
 *  Declared before the db singleton initialization (seed() reads it at eval). */
const CAMPAIGN_QUERIES: Record<string, string> = {
  "mac-summer-2026":
    "at least part of the video features MAC facial makeup and complexion products (foundation, concealer, powder), with the creator doing a get-ready-with-me, makeup tutorial, or product introduction applying it to their face",
  "boj-summer-2026":
    "at least part of the video features a Beauty of Joseon skincare product (especially Dynasty Cream), with the creator doing a get-ready-with-me, skincare-routine tutorial, or product introduction applying it to their skin.",
};

/* ------------------------------------------------------------------ */
/* Connection (singleton, survives Next.js HMR)                        */
/* ------------------------------------------------------------------ */

function createDb(): Database.Database {
  fs.mkdirSync(CONFIG.dataDir, { recursive: true });
  fs.mkdirSync(CONFIG.uploadsDir, { recursive: true });
  const db = new Database(path.join(CONFIG.dataDir, "brandsafe.db"));
  db.pragma("journal_mode = WAL");
  migrate(db);
  seed(db);
  return db;
}

const g = globalThis as unknown as { __brandsafeDb?: Database.Database };
export const db: Database.Database = g.__brandsafeDb ?? (g.__brandsafeDb = createDb());

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS brands (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      logo TEXT NOT NULL,
      tl_index_id TEXT
    );
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      brand_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      ad_creative_focus TEXT NOT NULL,
      search_query TEXT NOT NULL,
      tl_index_id TEXT
    );
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      duration_s REAL,
      tl_index_id TEXT,
      tl_task_id TEXT,
      tl_video_id TEXT,
      tl_asset_id TEXT,
      hls_url TEXT,
      thumbnail_url TEXT,
      state TEXT NOT NULL,
      state_detail TEXT,
      prefilter_signal REAL,
      promoted INTEGER NOT NULL DEFAULT 0,
      disposition TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      description TEXT,
      observation_json TEXT,
      relevance_json TEXT,
      status TEXT NOT NULL,
      status_detail TEXT,
      jurisdictions_json TEXT NOT NULL DEFAULT '[]',
      results_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS actions (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      type TEXT NOT NULL,
      jurisdiction TEXT,
      template_text TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Idempotent column adds for DBs created before later changes.
  addColumnIfMissing(db, "brands", "tl_index_id", "TEXT");
  addColumnIfMissing(db, "videos", "prefilter_signal", "REAL");
  addColumnIfMissing(db, "videos", "disposition", "TEXT");
  addColumnIfMissing(db, "reports", "relevance_json", "TEXT");
}

function addColumnIfMissing(db: Database.Database, table: string, col: string, type: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
  }
}

/* ------------------------------------------------------------------ */
/* Seed (brands + campaigns)                                           */
/* ------------------------------------------------------------------ */

function seed(db: Database.Database) {
  // Backfill the default pre-filter query ONLY when missing — preserve user edits.
  const upd = db.prepare(
    "UPDATE campaigns SET search_query = ? WHERE id = ? AND (search_query IS NULL OR search_query = '')"
  );
  for (const [id, q] of Object.entries(CAMPAIGN_QUERIES)) upd.run(q, id);

  const count = db.prepare("SELECT COUNT(*) AS n FROM brands").get() as { n: number };
  if (count.n > 0) return;

  const insBrand = db.prepare("INSERT INTO brands (id, name, logo) VALUES (?, ?, ?)");
  insBrand.run("mac", "MAC Cosmetics", "💄");
  insBrand.run("boj", "Beauty of Joseon", "🌿");

  const insCamp = db.prepare(
    `INSERT INTO campaigns (id, brand_id, name, description, ad_creative_focus, search_query, tl_index_id)
     VALUES (@id, @brandId, @name, @description, @adCreativeFocus, @searchQuery, NULL)`
  );
  insCamp.run({
    id: "mac-summer-2026",
    brandId: "mac",
    name: "2026 Summer — Facial Makeup",
    description:
      "MAC's 2026 summer line for facial makeup: lightweight foundation, complexion and finishing products built for warm-weather wear. The campaign promotes long-wear coverage with a fresh, natural finish.",
    adCreativeFocus:
      "Creator tutorial / GRWM (get-ready-with-me) applying facial foundation and complexion makeup.",
    searchQuery: CAMPAIGN_QUERIES["mac-summer-2026"],
  });
  insCamp.run({
    id: "boj-summer-2026",
    brandId: "boj",
    name: "2026 Summer — Skincare",
    description:
      "Beauty of Joseon's 2026 summer skincare campaign centered on the hero serum and daily sunscreen. The creative should showcase a calm, glass-skin routine suited to hot, humid summer days.",
    adCreativeFocus:
      "Creator skincare-routine tutorial / GRWM applying facial serum and sunscreen.",
    searchQuery: CAMPAIGN_QUERIES["boj-summer-2026"],
  });
}

/* ------------------------------------------------------------------ */
/* Row mappers                                                         */
/* ------------------------------------------------------------------ */

type VideoRow = {
  id: string;
  campaign_id: string;
  filename: string;
  file_path: string;
  duration_s: number | null;
  tl_index_id: string | null;
  tl_task_id: string | null;
  tl_video_id: string | null;
  tl_asset_id: string | null;
  hls_url: string | null;
  thumbnail_url: string | null;
  state: string;
  state_detail: string | null;
  prefilter_signal: number | null;
  promoted: number;
  disposition: string | null;
  created_at: string;
};

function mapVideo(r: VideoRow): VideoRecord {
  return {
    id: r.id,
    campaignId: r.campaign_id,
    filename: r.filename,
    filePath: r.file_path,
    durationS: r.duration_s,
    tlIndexId: r.tl_index_id,
    tlTaskId: r.tl_task_id,
    tlVideoId: r.tl_video_id,
    tlAssetId: r.tl_asset_id,
    hlsUrl: r.hls_url,
    thumbnailUrl: r.thumbnail_url,
    state: r.state as VideoState,
    stateDetail: r.state_detail,
    prefilterSignal: r.prefilter_signal,
    promoted: !!r.promoted,
    disposition: (r.disposition as VideoRecord["disposition"]) ?? null,
    createdAt: r.created_at,
  };
}

type ReportRow = {
  id: string;
  video_id: string;
  description: string | null;
  observation_json: string | null;
  relevance_json: string | null;
  status: string;
  status_detail: string | null;
  jurisdictions_json: string;
  results_json: string;
  created_at: string;
};

/**
 * Drop suppressed verdicts (see SUPPRESSED_VERDICT_CATEGORIES / _RULE_IDS) and
 * recompute the decision so already-persisted reports stay consistent with the
 * demo suppression. Applied on every report read.
 */
function normalizeResults(results: JurisdictionResult[]): JurisdictionResult[] {
  if (SUPPRESSED_VERDICT_CATEGORIES.length === 0 && SUPPRESSED_VERDICT_RULE_IDS.length === 0)
    return results;
  return results.map((res) => {
    const verdicts = res.verdicts.filter((v) => !isSuppressedVerdict(v));
    if (verdicts.length === res.verdicts.length) return res;
    return { ...res, verdicts, decision: decide(verdicts) };
  });
}

function mapReport(r: ReportRow): ReportRecord {
  return {
    id: r.id,
    videoId: r.video_id,
    description: r.description,
    observation: r.observation_json ? (JSON.parse(r.observation_json) as Observation) : null,
    relevance: r.relevance_json ? (JSON.parse(r.relevance_json) as RelevanceVerdict) : null,
    status: r.status as ReportRecord["status"],
    statusDetail: r.status_detail,
    jurisdictions: JSON.parse(r.jurisdictions_json || "[]") as JurisdictionCode[],
    results: normalizeResults(JSON.parse(r.results_json || "[]") as JurisdictionResult[]),
    createdAt: r.created_at,
  };
}

/* ------------------------------------------------------------------ */
/* Brand / campaign queries                                            */
/* ------------------------------------------------------------------ */

function mapBrand(r: Record<string, unknown>): Brand {
  return {
    id: r.id as string,
    name: r.name as string,
    logo: r.logo as string,
    tlIndexId: (r.tl_index_id as string) ?? null,
  };
}

export function listBrands(): Brand[] {
  return (db.prepare("SELECT * FROM brands ORDER BY name").all() as Record<string, unknown>[]).map(mapBrand);
}

export function getBrand(id: string): Brand | undefined {
  const r = db.prepare("SELECT * FROM brands WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return r ? mapBrand(r) : undefined;
}

export function setBrandIndex(brandId: string, indexId: string) {
  db.prepare("UPDATE brands SET tl_index_id = ? WHERE id = ?").run(indexId, brandId);
}

function mapCampaign(r: Record<string, unknown>): Campaign {
  return {
    id: r.id as string,
    brandId: r.brand_id as string,
    name: r.name as string,
    description: r.description as string,
    adCreativeFocus: r.ad_creative_focus as string,
    searchQuery: r.search_query as string,
    tlIndexId: (r.tl_index_id as string) ?? null,
  };
}

export function listCampaignsByBrand(brandId: string): Campaign[] {
  return (db.prepare("SELECT * FROM campaigns WHERE brand_id = ? ORDER BY name").all(brandId) as Record<
    string,
    unknown
  >[]).map(mapCampaign);
}

export function getCampaign(id: string): Campaign | undefined {
  const r = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return r ? mapCampaign(r) : undefined;
}

export function setCampaignIndex(campaignId: string, indexId: string) {
  db.prepare("UPDATE campaigns SET tl_index_id = ? WHERE id = ?").run(indexId, campaignId);
}

export function setCampaignQuery(campaignId: string, query: string) {
  db.prepare("UPDATE campaigns SET search_query = ? WHERE id = ?").run(query, campaignId);
}

const CAMPAIGN_FIELD_COLS: Record<string, string> = {
  searchQuery: "search_query",
  description: "description",
  adCreativeFocus: "ad_creative_focus",
};

export function updateCampaignBrief(
  campaignId: string,
  patch: Partial<{ searchQuery: string; description: string; adCreativeFocus: string }>
) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (CAMPAIGN_FIELD_COLS[k] && typeof v === "string") {
      sets.push(`${CAMPAIGN_FIELD_COLS[k]} = ?`);
      vals.push(v);
    }
  }
  if (!sets.length) return;
  vals.push(campaignId);
  db.prepare(`UPDATE campaigns SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
}

/* ------------------------------------------------------------------ */
/* Video queries                                                       */
/* ------------------------------------------------------------------ */

export function insertVideo(v: {
  id: string;
  campaignId: string;
  filename: string;
  filePath: string;
  state: VideoState;
}) {
  db.prepare(
    `INSERT INTO videos (id, campaign_id, filename, file_path, state, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(v.id, v.campaignId, v.filename, v.filePath, v.state, new Date().toISOString());
}

export function getVideo(id: string): VideoRecord | undefined {
  const r = db.prepare("SELECT * FROM videos WHERE id = ?").get(id) as VideoRow | undefined;
  return r ? mapVideo(r) : undefined;
}

export function listVideosByCampaign(campaignId: string): VideoRecord[] {
  return (
    db.prepare("SELECT * FROM videos WHERE campaign_id = ? ORDER BY created_at DESC").all(campaignId) as VideoRow[]
  ).map(mapVideo);
}

const VIDEO_COLS: Record<string, string> = {
  durationS: "duration_s",
  tlIndexId: "tl_index_id",
  tlTaskId: "tl_task_id",
  tlVideoId: "tl_video_id",
  tlAssetId: "tl_asset_id",
  hlsUrl: "hls_url",
  thumbnailUrl: "thumbnail_url",
  state: "state",
  stateDetail: "state_detail",
  prefilterSignal: "prefilter_signal",
  promoted: "promoted",
  disposition: "disposition",
};

export function updateVideo(
  id: string,
  patch: Partial<{
    durationS: number | null;
    tlIndexId: string | null;
    tlTaskId: string | null;
    tlVideoId: string | null;
    tlAssetId: string | null;
    hlsUrl: string | null;
    thumbnailUrl: string | null;
    state: VideoState;
    stateDetail: string | null;
    prefilterSignal: number | null;
    promoted: boolean;
    disposition: VideoRecord["disposition"];
  }>
) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (k === "promoted") {
      sets.push("promoted = ?");
      vals.push(v ? 1 : 0);
    } else if (VIDEO_COLS[k]) {
      sets.push(`${VIDEO_COLS[k]} = ?`);
      vals.push(v as unknown);
    }
  }
  if (!sets.length) return;
  vals.push(id);
  db.prepare(`UPDATE videos SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
}

export function deleteVideo(id: string) {
  db.prepare("DELETE FROM reports WHERE video_id = ?").run(id);
  db.prepare("DELETE FROM actions WHERE video_id = ?").run(id);
  db.prepare("DELETE FROM videos WHERE id = ?").run(id);
}

/* ------------------------------------------------------------------ */
/* Report queries                                                      */
/* ------------------------------------------------------------------ */

export function insertReport(r: {
  id: string;
  videoId: string;
  jurisdictions: JurisdictionCode[];
}) {
  db.prepare(
    `INSERT INTO reports (id, video_id, status, jurisdictions_json, created_at)
     VALUES (?, ?, 'RUNNING', ?, ?)`
  ).run(r.id, r.videoId, JSON.stringify(r.jurisdictions), new Date().toISOString());
}

export function updateReport(
  id: string,
  patch: Partial<{
    description: string | null;
    observation: Observation | null;
    relevance: RelevanceVerdict | null;
    status: ReportRecord["status"];
    statusDetail: string | null;
    results: JurisdictionResult[];
  }>
) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if ("description" in patch) {
    sets.push("description = ?");
    vals.push(patch.description);
  }
  if ("observation" in patch) {
    sets.push("observation_json = ?");
    vals.push(patch.observation ? JSON.stringify(patch.observation) : null);
  }
  if ("relevance" in patch) {
    sets.push("relevance_json = ?");
    vals.push(patch.relevance ? JSON.stringify(patch.relevance) : null);
  }
  if ("status" in patch) {
    sets.push("status = ?");
    vals.push(patch.status);
  }
  if ("statusDetail" in patch) {
    sets.push("status_detail = ?");
    vals.push(patch.statusDetail);
  }
  if ("results" in patch) {
    sets.push("results_json = ?");
    vals.push(JSON.stringify(patch.results));
  }
  if (!sets.length) return;
  vals.push(id);
  db.prepare(`UPDATE reports SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
}

export function getReport(id: string): ReportRecord | undefined {
  const r = db.prepare("SELECT * FROM reports WHERE id = ?").get(id) as ReportRow | undefined;
  return r ? mapReport(r) : undefined;
}

export function getReportByVideo(videoId: string): ReportRecord | undefined {
  const r = db
    .prepare("SELECT * FROM reports WHERE video_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(videoId) as ReportRow | undefined;
  return r ? mapReport(r) : undefined;
}

export function listReports(): ReportRecord[] {
  return (db.prepare("SELECT * FROM reports ORDER BY created_at DESC").all() as ReportRow[]).map(mapReport);
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export function insertAction(a: {
  id: string;
  videoId: string;
  type: ActionType;
  jurisdiction?: string | null;
  templateText?: string | null;
}) {
  db.prepare(
    `INSERT INTO actions (id, video_id, type, jurisdiction, template_text, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(a.id, a.videoId, a.type, a.jurisdiction ?? null, a.templateText ?? null, new Date().toISOString());
}
