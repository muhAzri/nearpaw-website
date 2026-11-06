import type { Page } from "@/backend/shared/domain/page";
import { distanceKm } from "@/backend/shared/domain/geo";
import type { CommunityUpdate } from "../../modules/reports/domain/community-update";
import type { Flag, FlagTarget } from "../../modules/reports/domain/flag";
import { effectiveState, URGENCY_RANK, type Report } from "../../modules/reports/domain/report";
import type {
  FlagRepository,
  ReportQuery,
  ReportRepository,
  UpdateRepository,
  UpdateSearch,
} from "../../modules/reports/domain/repositories";

const page = <T>(items: T[], offset: number, limit: number): Page<T> => ({
  items: items.slice(offset, offset + limit),
  total: items.length,
});

export class InMemoryReportRepository implements ReportRepository {
  private readonly items = new Map<string, Report>();

  async add(report: Report) {
    this.items.set(report.id, report);
  }
  async save(report: Report) {
    this.items.set(report.id, report);
  }
  async findById(id: string) {
    return this.items.get(id) ?? null;
  }
  async findByRef(ref: string) {
    return [...this.items.values()].find((r) => r.ref === ref.toUpperCase()) ?? null;
  }

  async search(q: ReportQuery): Promise<Page<Report>> {
    const dist = (r: Report) => (q.center ? distanceKm(q.center, r.location) : 0);
    const hits = [...this.items.values()].filter(
      (r) =>
        (!q.states || q.states.includes(effectiveState(r, q.now))) &&
        (!q.refContains || r.ref.includes(q.refContains.toUpperCase())) &&
        (!q.regionId || r.regionId === q.regionId) &&
        (!q.animals?.length || q.animals.includes(r.animal)) &&
        (!q.conditions?.length || q.conditions.includes(r.condition)) &&
        (!q.urgency || r.urgency === q.urgency) &&
        (!q.reporterId || r.reporterId === q.reporterId) &&
        !q.excludeReporterIds?.includes(r.reporterId) &&
        (!q.center || !q.radiusKm || dist(r) <= q.radiusKm) &&
        (!q.createdAfter || r.createdAt >= q.createdAfter) &&
        (!q.createdBefore || r.createdAt <= q.createdBefore) &&
        (q.minOpenFlags === undefined || r.openFlags >= q.minOpenFlags),
    );
    const newest = (a: Report, b: Report) => b.createdAt.getTime() - a.createdAt.getTime();
    hits.sort((a, b) => {
      switch (q.sort) {
        case "nearby":
          return dist(a) - dist(b) || newest(a, b);
        case "urgent":
          return URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency] || newest(a, b);
        case "most_flags":
          return b.openFlags - a.openFlags || newest(a, b);
        default:
          return newest(a, b);
      }
    });
    return page(hits, q.offset, q.limit);
  }

  async countByReporterSince(reporterId: string, since: Date) {
    return [...this.items.values()].filter((r) => r.reporterId === reporterId && r.createdAt >= since).length;
  }
  async listByReporter(reporterId: string) {
    return [...this.items.values()].filter((r) => r.reporterId === reporterId);
  }
}

export class InMemoryUpdateRepository implements UpdateRepository {
  private readonly items = new Map<string, CommunityUpdate>();

  async add(u: CommunityUpdate) {
    this.items.set(u.id, u);
  }
  async save(u: CommunityUpdate) {
    this.items.set(u.id, u);
  }
  async findById(id: string) {
    return this.items.get(id) ?? null;
  }
  async listByReport(reportId: string) {
    return [...this.items.values()]
      .filter((u) => u.reportId === reportId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async listByAuthor(authorId: string) {
    return [...this.items.values()].filter((u) => u.authorId === authorId);
  }
  async countByAuthorSince(authorId: string, since: Date) {
    return [...this.items.values()].filter((u) => u.authorId === authorId && u.createdAt >= since).length;
  }
  async search({ filter, limit, offset }: UpdateSearch) {
    const hits = [...this.items.values()]
      .filter((u) => (filter === "all" ? true : filter === "hidden" ? u.state === "hidden" : u.openFlags > 0))
      .sort((a, b) => b.openFlags - a.openFlags || b.createdAt.getTime() - a.createdAt.getTime());
    return page(hits, offset, limit);
  }
}

export class InMemoryFlagRepository implements FlagRepository {
  private readonly items = new Map<string, Flag>();
  private counter = 200;

  async nextNumber() {
    return ++this.counter;
  }
  async add(f: Flag) {
    this.items.set(f.id, f);
  }
  async save(f: Flag) {
    this.items.set(f.id, f);
  }
  async findById(id: string) {
    return this.items.get(id) ?? null;
  }
  async findByNumber(n: number) {
    return [...this.items.values()].find((f) => f.number === n) ?? null;
  }
  async openFor(type: FlagTarget, targetId: string) {
    return [...this.items.values()].filter((f) => f.status === "open" && f.targetType === type && f.targetId === targetId);
  }
  async hasFlagged(flaggerId: string, type: FlagTarget, targetId: string) {
    return [...this.items.values()].some((f) => f.flaggerId === flaggerId && f.targetType === type && f.targetId === targetId);
  }
  async search({ status, limit, offset }: { status: "open" | "resolved"; limit: number; offset: number }) {
    const hits = [...this.items.values()]
      .filter((f) => f.status === status)
      .sort((a, b) => (status === "open" ? 1 : -1) * (a.createdAt.getTime() - b.createdAt.getTime()));
    return page(hits, offset, limit);
  }
  async countAgainst(type: FlagTarget, ids: string[]) {
    const set = new Set(ids);
    return [...this.items.values()].filter((f) => f.targetType === type && set.has(f.targetId)).length;
  }
  async allOpen() {
    return [...this.items.values()].filter((f) => f.status === "open");
  }
}
