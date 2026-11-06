import type { SupabaseClient } from "@supabase/supabase-js";
import { distanceKm } from "@/backend/shared/domain/geo";
import type { Page } from "@/backend/shared/domain/page";
import { check, unwrap } from "@/backend/shared/infrastructure/supabase-admin";
import type { CommunityUpdate } from "../domain/community-update";
import type { Flag, FlagTarget } from "../domain/flag";
import type { Report } from "../domain/report";
import type { FlagRepository, ReportQuery, ReportRepository, UpdateRepository, UpdateSearch } from "../domain/repositories";

// ---- reports ----

export interface ReportRow {
  id: string;
  ref: string;
  reporter_id: string;
  animal: Report["animal"];
  condition: Report["condition"];
  urgency: Report["urgency"];
  description: string;
  photos: string[];
  lat: number;
  lng: number;
  location_label: string | null;
  region_id: string | null;
  area_name: string | null;
  language: "en" | "id";
  state: Report["state"];
  hidden_by: Report["hiddenBy"];
  moderation_reason: string | null;
  duplicate_of_ref: string | null;
  open_flags: number;
  created_at: string;
  expires_at: string;
  closed_at: string | null;
}

export const reportFromRow = (r: ReportRow): Report => ({
  id: r.id,
  ref: r.ref,
  reporterId: r.reporter_id,
  animal: r.animal,
  condition: r.condition,
  urgency: r.urgency,
  description: r.description,
  photos: r.photos,
  location: { lat: r.lat, lng: r.lng },
  locationLabel: r.location_label,
  regionId: r.region_id,
  areaName: r.area_name,
  language: r.language,
  state: r.state,
  hiddenBy: r.hidden_by,
  moderationReason: r.moderation_reason,
  duplicateOfRef: r.duplicate_of_ref,
  openFlags: r.open_flags,
  createdAt: new Date(r.created_at),
  expiresAt: new Date(r.expires_at),
  closedAt: r.closed_at ? new Date(r.closed_at) : null,
});

export const reportToRow = (r: Report): ReportRow => ({
  id: r.id,
  ref: r.ref,
  reporter_id: r.reporterId,
  animal: r.animal,
  condition: r.condition,
  urgency: r.urgency,
  description: r.description,
  photos: [...r.photos],
  lat: r.location.lat,
  lng: r.location.lng,
  location_label: r.locationLabel,
  region_id: r.regionId,
  area_name: r.areaName,
  language: r.language,
  state: r.state,
  hidden_by: r.hiddenBy,
  moderation_reason: r.moderationReason,
  duplicate_of_ref: r.duplicateOfRef,
  open_flags: r.openFlags,
  created_at: r.createdAt.toISOString(),
  expires_at: r.expiresAt.toISOString(),
  closed_at: r.closedAt?.toISOString() ?? null,
});

/** Rows scanned when a search has to be ordered or filtered by distance (PostgREST has no haversine). */
const GEO_SCAN_LIMIT = 5000;
const KM_PER_DEGREE = 111.32;
const quote = (v: string) => `"${v}"`;
const likeSafe = (v: string) => v.replace(/[%_,()"\\]/g, "");

/** Effective states (expiry is derived, not stored) as a PostgREST `or` filter. */
export function stateFilter(states: Report["state"][], now: Date): string {
  const at = quote(now.toISOString());
  return states
    .map((s) => (s === "live" ? `and(state.eq.live,expires_at.gt.${at})` : s === "expired" ? `and(state.eq.live,expires_at.lte.${at})` : `state.eq.${s}`))
    .join(",");
}

/** `reports` table through the secret key. */
export class SupabaseReportRepository implements ReportRepository {
  constructor(private readonly db: SupabaseClient) {}

  async add(report: Report) {
    check(await this.db.from("reports").insert(reportToRow(report)), "reports.add");
  }
  async save(report: Report) {
    check(await this.db.from("reports").upsert(reportToRow(report), { onConflict: "id" }), "reports.save");
  }
  async findById(id: string) {
    const row = unwrap(await this.db.from("reports").select("*").eq("id", id).maybeSingle<ReportRow>(), "reports.findById");
    return row ? reportFromRow(row) : null;
  }
  async findByRef(ref: string) {
    const row = unwrap(await this.db.from("reports").select("*").eq("ref", ref.toUpperCase()).maybeSingle<ReportRow>(), "reports.findByRef");
    return row ? reportFromRow(row) : null;
  }

  async search(q: ReportQuery): Promise<Page<Report>> {
    let query = this.db.from("reports").select("*", { count: "exact" });
    if (q.states) query = query.or(stateFilter(q.states, q.now));
    if (q.refContains) query = query.ilike("ref", `%${likeSafe(q.refContains)}%`);
    if (q.regionId) query = query.eq("region_id", q.regionId);
    if (q.animals?.length) query = query.in("animal", q.animals);
    if (q.conditions?.length) query = query.in("condition", q.conditions);
    if (q.urgency) query = query.eq("urgency", q.urgency);
    if (q.reporterId) query = query.eq("reporter_id", q.reporterId);
    if (q.excludeReporterIds?.length) query = query.not("reporter_id", "in", `(${q.excludeReporterIds.join(",")})`);
    if (q.createdAfter) query = query.gte("created_at", q.createdAfter.toISOString());
    if (q.createdBefore) query = query.lte("created_at", q.createdBefore.toISOString());
    if (q.minOpenFlags !== undefined) query = query.gte("open_flags", q.minOpenFlags);

    const byDistance = q.center && (q.sort === "nearby" || q.radiusKm);
    if (byDistance && q.center) {
      if (q.radiusKm) {
        // Cheap bounding box in SQL, exact distance below.
        const dLat = q.radiusKm / KM_PER_DEGREE;
        const dLng = q.radiusKm / (KM_PER_DEGREE * Math.max(0.01, Math.cos((q.center.lat * Math.PI) / 180)));
        query = query.gte("lat", q.center.lat - dLat).lte("lat", q.center.lat + dLat).gte("lng", q.center.lng - dLng).lte("lng", q.center.lng + dLng);
      }
      const { data, error } = await query.order("created_at", { ascending: false }).range(0, GEO_SCAN_LIMIT - 1);
      if (error) throw new Error(`reports.search: ${error.message}`);
      const center = q.center;
      const dist = (r: Report) => distanceKm(center, r.location);
      let hits = ((data ?? []) as ReportRow[]).map(reportFromRow);
      if (q.radiusKm) hits = hits.filter((r) => dist(r) <= q.radiusKm!);
      if (q.sort === "nearby") hits.sort((a, b) => dist(a) - dist(b) || b.createdAt.getTime() - a.createdAt.getTime());
      return { items: hits.slice(q.offset, q.offset + q.limit), total: hits.length };
    }

    switch (q.sort) {
      case "urgent":
        query = query.order("urgency_rank", { ascending: false }).order("created_at", { ascending: false });
        break;
      case "most_flags":
        query = query.order("open_flags", { ascending: false }).order("created_at", { ascending: false });
        break;
      default:
        query = query.order("created_at", { ascending: false });
    }
    const { data, error, count } = await query.range(q.offset, q.offset + q.limit - 1);
    if (error) throw new Error(`reports.search: ${error.message}`);
    return { items: ((data ?? []) as ReportRow[]).map(reportFromRow), total: count ?? 0 };
  }

  async listWithStalePhotos(cutoff: Date, limit: number) {
    const at = cutoff.toISOString();
    const rows = unwrap(
      await this.db
        .from("reports")
        .select("*")
        .neq("photos", "{}")
        .or(`expires_at.lt.${at},state.eq.removed,and(state.eq.closed,closed_at.lt.${at})`)
        .order("created_at", { ascending: true })
        .limit(limit),
      "reports.listWithStalePhotos",
    );
    return (rows as ReportRow[]).map(reportFromRow);
  }
  async countByReporterSince(reporterId: string, since: Date) {
    const { count, error } = await this.db.from("reports").select("*", { count: "exact", head: true }).eq("reporter_id", reporterId).gte("created_at", since.toISOString());
    if (error) throw new Error(`reports.countByReporterSince: ${error.message}`);
    return count ?? 0;
  }
  async listByReporter(reporterId: string) {
    const rows = unwrap(await this.db.from("reports").select("*").eq("reporter_id", reporterId).order("created_at", { ascending: false }), "reports.listByReporter");
    return (rows as ReportRow[]).map(reportFromRow);
  }
}

// ---- community updates ----

export interface UpdateRow {
  id: string;
  ref: string;
  report_id: string;
  report_ref: string;
  author_id: string;
  type: CommunityUpdate["type"];
  note: string | null;
  photos: string[];
  state: CommunityUpdate["state"];
  hidden_by: CommunityUpdate["hiddenBy"];
  open_flags: number;
  created_at: string;
}

export const updateFromRow = (r: UpdateRow): CommunityUpdate => ({
  id: r.id,
  ref: r.ref,
  reportId: r.report_id,
  reportRef: r.report_ref,
  authorId: r.author_id,
  type: r.type,
  note: r.note,
  photos: r.photos,
  state: r.state,
  hiddenBy: r.hidden_by,
  openFlags: r.open_flags,
  createdAt: new Date(r.created_at),
});

export const updateToRow = (u: CommunityUpdate): UpdateRow => ({
  id: u.id,
  ref: u.ref,
  report_id: u.reportId,
  report_ref: u.reportRef,
  author_id: u.authorId,
  type: u.type,
  note: u.note,
  photos: [...u.photos],
  state: u.state,
  hidden_by: u.hiddenBy,
  open_flags: u.openFlags,
  created_at: u.createdAt.toISOString(),
});

/** `community_updates` table through the secret key. */
export class SupabaseUpdateRepository implements UpdateRepository {
  constructor(private readonly db: SupabaseClient) {}

  async add(u: CommunityUpdate) {
    check(await this.db.from("community_updates").insert(updateToRow(u)), "updates.add");
  }
  async save(u: CommunityUpdate) {
    check(await this.db.from("community_updates").upsert(updateToRow(u), { onConflict: "id" }), "updates.save");
  }
  async findById(id: string) {
    const row = unwrap(await this.db.from("community_updates").select("*").eq("id", id).maybeSingle<UpdateRow>(), "updates.findById");
    return row ? updateFromRow(row) : null;
  }
  async listByReport(reportId: string) {
    const rows = unwrap(await this.db.from("community_updates").select("*").eq("report_id", reportId).order("created_at", { ascending: false }), "updates.listByReport");
    return (rows as UpdateRow[]).map(updateFromRow);
  }
  async listByAuthor(authorId: string) {
    const rows = unwrap(await this.db.from("community_updates").select("*").eq("author_id", authorId).order("created_at", { ascending: false }), "updates.listByAuthor");
    return (rows as UpdateRow[]).map(updateFromRow);
  }
  async countByAuthorSince(authorId: string, since: Date) {
    const { count, error } = await this.db.from("community_updates").select("*", { count: "exact", head: true }).eq("author_id", authorId).gte("created_at", since.toISOString());
    if (error) throw new Error(`updates.countByAuthorSince: ${error.message}`);
    return count ?? 0;
  }
  async search({ filter, limit, offset }: UpdateSearch): Promise<Page<CommunityUpdate>> {
    let query = this.db.from("community_updates").select("*", { count: "exact" });
    if (filter === "hidden") query = query.eq("state", "hidden");
    else if (filter === "flagged") query = query.gt("open_flags", 0);
    const { data, error, count } = await query.order("open_flags", { ascending: false }).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw new Error(`updates.search: ${error.message}`);
    return { items: ((data ?? []) as UpdateRow[]).map(updateFromRow), total: count ?? 0 };
  }
}

// ---- flags ----

export interface FlagRow {
  id: string;
  number: number;
  target_type: FlagTarget;
  target_id: string;
  target_ref: string;
  flagger_id: string;
  reason: Flag["reason"];
  details: string | null;
  status: Flag["status"];
  outcome: Flag["outcome"];
  notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

export const flagFromRow = (r: FlagRow): Flag => ({
  id: r.id,
  number: Number(r.number),
  targetType: r.target_type,
  targetId: r.target_id,
  targetRef: r.target_ref,
  flaggerId: r.flagger_id,
  reason: r.reason,
  details: r.details,
  status: r.status,
  outcome: r.outcome,
  notes: r.notes,
  createdAt: new Date(r.created_at),
  resolvedAt: r.resolved_at ? new Date(r.resolved_at) : null,
});

export const flagToRow = (f: Flag): FlagRow => ({
  id: f.id,
  number: f.number,
  target_type: f.targetType,
  target_id: f.targetId,
  target_ref: f.targetRef,
  flagger_id: f.flaggerId,
  reason: f.reason,
  details: f.details,
  status: f.status,
  outcome: f.outcome,
  notes: f.notes,
  created_at: f.createdAt.toISOString(),
  resolved_at: f.resolvedAt?.toISOString() ?? null,
});

/** `flags` table through the secret key. */
export class SupabaseFlagRepository implements FlagRepository {
  constructor(private readonly db: SupabaseClient) {}

  async nextNumber() {
    return Number(unwrap(await this.db.rpc("next_flag_number"), "flags.nextNumber"));
  }
  async add(f: Flag) {
    check(await this.db.from("flags").insert(flagToRow(f)), "flags.add");
  }
  async save(f: Flag) {
    check(await this.db.from("flags").upsert(flagToRow(f), { onConflict: "id" }), "flags.save");
  }
  async findById(id: string) {
    const row = unwrap(await this.db.from("flags").select("*").eq("id", id).maybeSingle<FlagRow>(), "flags.findById");
    return row ? flagFromRow(row) : null;
  }
  async findByNumber(n: number) {
    const row = unwrap(await this.db.from("flags").select("*").eq("number", n).maybeSingle<FlagRow>(), "flags.findByNumber");
    return row ? flagFromRow(row) : null;
  }
  async openFor(type: FlagTarget, targetId: string) {
    const rows = unwrap(await this.db.from("flags").select("*").eq("status", "open").eq("target_type", type).eq("target_id", targetId), "flags.openFor");
    return (rows as FlagRow[]).map(flagFromRow);
  }
  async hasFlagged(flaggerId: string, type: FlagTarget, targetId: string) {
    const { count, error } = await this.db.from("flags").select("*", { count: "exact", head: true }).eq("flagger_id", flaggerId).eq("target_type", type).eq("target_id", targetId);
    if (error) throw new Error(`flags.hasFlagged: ${error.message}`);
    return (count ?? 0) > 0;
  }
  async search({ status, limit, offset }: { status: "open" | "resolved"; limit: number; offset: number }): Promise<Page<Flag>> {
    const { data, error, count } = await this.db
      .from("flags")
      .select("*", { count: "exact" })
      .eq("status", status)
      .order("created_at", { ascending: status === "open" }) // open: oldest first; resolved: newest first
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`flags.search: ${error.message}`);
    return { items: ((data ?? []) as FlagRow[]).map(flagFromRow), total: count ?? 0 };
  }
  async countAgainst(type: FlagTarget, ids: string[]) {
    if (ids.length === 0) return 0;
    const { count, error } = await this.db.from("flags").select("*", { count: "exact", head: true }).eq("target_type", type).in("target_id", ids);
    if (error) throw new Error(`flags.countAgainst: ${error.message}`);
    return count ?? 0;
  }
  async allOpen() {
    const rows = unwrap(await this.db.from("flags").select("*").eq("status", "open"), "flags.allOpen");
    return (rows as FlagRow[]).map(flagFromRow);
  }
}
