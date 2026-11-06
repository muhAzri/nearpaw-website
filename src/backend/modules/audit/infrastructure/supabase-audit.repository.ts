import type { SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@/backend/shared/domain/page";
import { check, unwrap } from "@/backend/shared/infrastructure/supabase-admin";
import type { AuditCriteria, AuditRecord, AuditRepository } from "../domain/audit-record";

export interface AuditRow {
  id: string;
  at: string;
  actor_kind: AuditRecord["actor"]["kind"];
  actor_id: string;
  action: string;
  target: string;
  reason: string | null;
  metadata: AuditRecord["metadata"];
}

export const auditFromRow = (r: AuditRow): AuditRecord => ({
  id: r.id,
  at: new Date(r.at),
  actor: { kind: r.actor_kind, id: r.actor_id },
  action: r.action,
  target: r.target,
  reason: r.reason,
  metadata: r.metadata,
});

export const auditToRow = (a: AuditRecord): AuditRow => ({
  id: a.id,
  at: a.at.toISOString(),
  actor_kind: a.actor.kind,
  actor_id: a.actor.id,
  action: a.action,
  target: a.target,
  reason: a.reason,
  metadata: a.metadata,
});

const likeSafe = (v: string) => v.replace(/[%_]/g, (c) => `\\${c}`);

/** Append-only `audit_log` table through the secret key (a trigger rejects updates and deletes). */
export class SupabaseAuditRepository implements AuditRepository {
  constructor(private readonly db: SupabaseClient) {}

  async append(record: AuditRecord) {
    check(await this.db.from("audit_log").insert(auditToRow(record)), "audit.append");
  }

  async search(c: AuditCriteria): Promise<Page<AuditRecord>> {
    let query = this.db.from("audit_log").select("*", { count: "exact" });
    if (c.actor) query = query.eq("actor_kind", c.actor);
    if (c.action) query = query.ilike("action", `${likeSafe(c.action)}%`);
    if (c.target) query = query.ilike("target", `%${likeSafe(c.target)}%`);
    if (c.from) query = query.gte("at", c.from.toISOString());
    if (c.to) query = query.lte("at", c.to.toISOString());
    const { data, error, count } = await query.order("at", { ascending: false }).range(c.offset, c.offset + c.limit - 1);
    if (error) throw new Error(`audit.search: ${error.message}`);
    return { items: ((data ?? []) as AuditRow[]).map(auditFromRow), total: count ?? 0 };
  }

  async recent(limit: number) {
    const rows = unwrap(await this.db.from("audit_log").select("*").order("at", { ascending: false }).limit(limit), "audit.recent");
    return (rows as AuditRow[]).map(auditFromRow);
  }
}
