import type { Clock } from "@/backend/shared/application/clock";
import { reportTitle, type Report } from "../domain/report";
import type { FlagRepository, ReportRepository, UpdateRepository } from "../domain/repositories";

export class ReportStats {
  constructor(
    private readonly reports: ReportRepository,
    private readonly updates: UpdateRepository,
    private readonly flags: FlagRepository,
    private readonly clock: Clock,
  ) {}

  async dashboard() {
    const now = this.clock.now();
    const day = new Date(now.getTime() - 86_400_000);
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const all = { now, sort: "newest" as const, offset: 0 };

    const [live, recent, hidden, newest, flagged, openFlags] = await Promise.all([
      this.reports.search({ ...all, states: ["live"], limit: 1 }),
      this.reports.search({ ...all, states: ["live", "closed", "hidden"], createdAfter: day, limit: 1 }),
      this.reports.search({ ...all, states: ["hidden"], createdAfter: startOfDay, limit: 100 }),
      this.reports.search({ ...all, states: ["live"], limit: 3 }),
      this.reports.search({ ...all, states: ["live"], minOpenFlags: 2, limit: 1 }),
      this.flags.allOpen(),
    ]);
    const oldest = openFlags.reduce<Date | null>((o, f) => (!o || f.createdAt < o ? f.createdAt : o), null);
    const row = (r: Report) => ({
      ref: r.ref,
      title: reportTitle(r),
      region: r.areaName,
      urgency: r.urgency,
      createdAt: r.createdAt.toISOString(),
    });
    return {
      liveReports: live.total,
      reportsLast24h: recent.total,
      openFlags: openFlags.length,
      oldestOpenFlagMinutes: oldest ? Math.floor((now.getTime() - oldest.getTime()) / 60_000) : null,
      autoHiddenToday: hidden.items.filter((r) => r.hiddenBy === "auto").length,
      reportsWithMultipleFlags: flagged.total,
      newest: newest.items.map(row),
    };
  }

  /** For the admin Users table. */
  async userActivity(userId: string) {
    const [reports, updates] = await Promise.all([this.reports.listByReporter(userId), this.updates.listByAuthor(userId)]);
    const against =
      (await this.flags.countAgainst("report", reports.map((r) => r.id))) +
      (await this.flags.countAgainst("update", updates.map((u) => u.id))) +
      (await this.flags.countAgainst("user", [userId]));
    return { reports: reports.length, updates: updates.length, flagsAgainst: against };
  }

  /** Account deletion: reports either stay anonymously or leave the map now. */
  async handleDeletedAccount(userId: string, mode: "keep_anonymous" | "delete") {
    if (mode === "keep_anonymous") return;
    for (const r of await this.reports.listByReporter(userId)) {
      if (r.state !== "removed") await this.reports.save({ ...r, state: "removed", hiddenBy: "owner", moderationReason: "account deleted" });
    }
  }
}
