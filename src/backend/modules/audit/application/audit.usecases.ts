import type { AuditEntryInput, AuditRecorder } from "@/backend/shared/application/audit";
import type { Clock } from "@/backend/shared/application/clock";
import type { AuditCriteria, AuditRecord, AuditRepository } from "../domain/audit-record";

export class AuditService implements AuditRecorder {
  constructor(
    private readonly repo: AuditRepository,
    private readonly clock: Clock,
  ) {}

  async record(entry: AuditEntryInput): Promise<void> {
    await this.repo.append({
      id: crypto.randomUUID(),
      at: this.clock.now(),
      actor: entry.actor,
      action: entry.action,
      target: entry.target,
      reason: entry.reason ?? null,
      metadata: entry.metadata ?? {},
    });
  }
}

export interface AuditDto {
  id: string;
  at: string;
  actor: "Admin" | "System";
  action: string;
  target: string;
  reason: string | null;
  metadata: Record<string, string | number | boolean>;
}

export const toAuditDto = (r: AuditRecord): AuditDto => ({
  id: r.id,
  at: r.at.toISOString(),
  actor: r.actor.kind === "admin" ? "Admin" : "System",
  action: r.action,
  target: r.target,
  reason: r.reason,
  metadata: r.metadata,
});

export class ListAudit {
  constructor(private readonly repo: AuditRepository) {}

  async execute(criteria: AuditCriteria) {
    const page = await this.repo.search(criteria);
    return { items: page.items.map(toAuditDto), total: page.total };
  }
}

export class RecentAudit {
  constructor(private readonly repo: AuditRepository) {}

  async execute(limit: number): Promise<AuditDto[]> {
    return (await this.repo.recent(limit)).map(toAuditDto);
  }
}
