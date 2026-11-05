import type { Page } from "@/backend/shared/domain/page";
import type { AuditCriteria, AuditRecord, AuditRepository } from "../domain/audit-record";

export class InMemoryAuditRepository implements AuditRepository {
  private readonly records: AuditRecord[] = [];

  async append(record: AuditRecord): Promise<void> {
    this.records.push(record);
  }

  async search(c: AuditCriteria): Promise<Page<AuditRecord>> {
    const hits = this.records
      .filter(
        (r) =>
          (!c.actor || r.actor.kind === c.actor) &&
          (!c.action || r.action.startsWith(c.action)) &&
          (!c.target || r.target.toLowerCase().includes(c.target.toLowerCase())) &&
          (!c.from || r.at >= c.from) &&
          (!c.to || r.at <= c.to),
      )
      .sort((a, b) => b.at.getTime() - a.at.getTime());
    return { items: hits.slice(c.offset, c.offset + c.limit), total: hits.length };
  }

  async recent(limit: number): Promise<AuditRecord[]> {
    return this.records.slice(-limit).reverse();
  }
}
