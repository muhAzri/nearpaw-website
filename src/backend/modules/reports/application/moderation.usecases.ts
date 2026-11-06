import type { AuditRecorder } from "@/backend/shared/application/audit";
import type { Clock } from "@/backend/shared/application/clock";
import { ConflictError, NotFoundError, ValidationError } from "@/backend/shared/domain/errors";
import type { MediaUrl } from "@/backend/shared/domain/media-key";
import { distanceKm } from "@/backend/shared/domain/geo";
import { actorOf, type Principal } from "@/backend/shared/domain/principal";
import { hideUpdate, restoreUpdate } from "../domain/community-update";
import type { Flag, FlagOutcome } from "../domain/flag";
import { effectiveState, hide, remove, reportTitle, restore, withOpenFlags, type Animal, type Report, type ReportState, type Urgency } from "../domain/report";
import type { FlagRepository, ReportRepository, UpdateRepository } from "../domain/repositories";
import type { ContributorDirectory } from "./ports";

const DUPLICATE_RADIUS_KM = 0.5;
const DUPLICATE_WINDOW_MS = 6 * 3_600_000;

export class ModerationService {
  constructor(
    private readonly reports: ReportRepository,
    private readonly updates: UpdateRepository,
    private readonly flags: FlagRepository,
    private readonly contributors: ContributorDirectory,
    private readonly audit: AuditRecorder,
    private readonly clock: Clock,
    private readonly mediaUrl: MediaUrl,
  ) {}

  // ---------------- reports ----------------
  private row(r: Report, now: Date) {
    return {
      ref: r.ref,
      title: reportTitle(r),
      region: r.areaName,
      urgency: r.urgency,
      state: effectiveState(r, now),
      hiddenBy: r.hiddenBy,
      flags: r.openFlags,
      createdAt: r.createdAt.toISOString(),
    };
  }

  async listReports(q: {
    q?: string;
    state?: ReportState;
    regionId?: string;
    animal?: Animal;
    urgency?: Urgency;
    from?: Date;
    to?: Date;
    sort: "newest" | "most_flags";
    limit: number;
    offset: number;
  }) {
    const now = this.clock.now();
    const page = await this.reports.search({
      now,
      states: q.state ? [q.state] : undefined,
      refContains: q.q,
      regionId: q.regionId,
      animals: q.animal ? [q.animal] : undefined,
      urgency: q.urgency,
      createdAfter: q.from,
      createdBefore: q.to,
      sort: q.sort,
      limit: q.limit,
      offset: q.offset,
    });
    return { items: page.items.map((r) => this.row(r, now)), total: page.total };
  }

  async reviewReport(ref: string) {
    const report = await this.reports.findByRef(ref);
    if (!report) throw new NotFoundError("Report not found");
    const now = this.clock.now();

    const [reporter, history, nearby, flags] = await Promise.all([
      this.contributors.reporterSummary(report.reporterId),
      this.reports.listByReporter(report.reporterId),
      this.reports.search({
        now,
        center: report.location,
        radiusKm: DUPLICATE_RADIUS_KM,
        createdAfter: new Date(report.createdAt.getTime() - DUPLICATE_WINDOW_MS),
        createdBefore: new Date(report.createdAt.getTime() + DUPLICATE_WINDOW_MS),
        states: ["live", "closed", "hidden"],
        sort: "nearby",
        limit: 10,
        offset: 0,
      }),
      this.flags.openFor("report", report.id),
    ]);

    return {
      ...this.row(report, now),
      animal: report.animal,
      condition: report.condition,
      description: report.description,
      language: report.language,
      location: report.location,
      locationLabel: report.locationLabel,
      moderationReason: report.moderationReason,
      duplicateOf: report.duplicateOfRef,
      liveForMinutes: Math.max(0, Math.floor((now.getTime() - report.createdAt.getTime()) / 60_000)),
      media: report.photos.map((publicKey) => ({
        publicKey,
        publicUrl: this.mediaUrl(publicKey),
        originalKey: publicKey.replace(/^public\//, "original/"),
        note: { original: "EXIF present (restricted)", public: "EXIF stripped (public)" },
      })),
      reporter: reporter && {
        label: reporter.label,
        accountAgeDays: reporter.accountAgeDays,
        history: {
          published: history.filter((r) => r.state !== "removed").length,
          rejected: history.filter((r) => r.state === "removed").length,
          flagsOnReports: history.reduce((n, r) => n + r.openFlags, 0),
        },
      },
      flagsDetail: flags.map((f) => ({ number: f.number, reason: f.reason, details: f.details, at: f.createdAt.toISOString() })),
      possibleDuplicates: nearby.items
        .filter((r) => r.id !== report.id)
        .map((r) => ({
          ref: r.ref,
          title: reportTitle(r),
          distanceM: Math.round(distanceKm(report.location, r.location) * 1000),
          createdAt: r.createdAt.toISOString(),
        })),
    };
  }

  async decideReport(
    admin: Principal,
    ref: string,
    d: { decision: "keep" | "duplicate" | "hide" | "remove"; reason: string; duplicateOf?: string },
  ) {
    const report = await this.reports.findByRef(ref);
    if (!report) throw new NotFoundError("Report not found");
    if (report.state === "removed") throw new ConflictError("This report was already removed");

    let next: Report;
    let action: string;
    switch (d.decision) {
      case "keep":
        next = withOpenFlags(restore(report), 0);
        action = "report.keep";
        await this.resolveOpenFlags("report", report.id, "none", `Kept live: ${d.reason}`);
        break;
      case "duplicate": {
        if (!d.duplicateOf || d.duplicateOf === ref) throw new ValidationError("Pick the report this duplicates");
        if (!(await this.reports.findByRef(d.duplicateOf))) throw new NotFoundError("The original report was not found");
        next = hide(report, "admin", d.reason, d.duplicateOf);
        action = "report.mark_duplicate";
        break;
      }
      case "hide":
        next = hide(report, "admin", d.reason);
        action = "report.hide";
        break;
      case "remove":
        next = remove(report, "admin", d.reason);
        action = "report.remove";
        break;
    }
    await this.reports.save(next);
    await this.audit.record({ actor: actorOf(admin), action, target: ref, reason: d.reason });
    return this.row(next, this.clock.now());
  }

  // ---------------- updates ----------------
  async listUpdates(c: { filter: "flagged" | "all" | "hidden"; limit: number; offset: number }) {
    const page = await this.updates.search(c);
    return {
      items: page.items.map((u) => ({
        id: u.id,
        ref: u.ref,
        type: u.type,
        reportRef: u.reportRef,
        note: u.note,
        photos: u.photos.length,
        state: u.state,
        flags: u.openFlags,
        createdAt: u.createdAt.toISOString(),
      })),
      total: page.total,
    };
  }

  async decideUpdate(admin: Principal, id: string, d: { decision: "hide" | "keep"; reason: string }) {
    const update = await this.updates.findById(id);
    if (!update) throw new NotFoundError("Update not found");
    const next = d.decision === "hide" ? hideUpdate(update, "admin") : { ...restoreUpdate(update), openFlags: 0 };
    await this.updates.save(next);
    if (d.decision === "keep") await this.resolveOpenFlags("update", update.id, "none", `Kept: ${d.reason}`);
    await this.audit.record({ actor: actorOf(admin), action: `update.${d.decision}`, target: update.ref, reason: d.reason });
    return { id, state: next.state };
  }

  // ---------------- flags ----------------
  private flagRow(f: Flag, now: Date, targetFlagCount: number) {
    return {
      id: f.id,
      number: f.number,
      targetType: f.targetType,
      targetRef: f.targetRef,
      reason: f.reason,
      details: f.details,
      status: f.status,
      outcome: f.outcome,
      flagsOnTarget: targetFlagCount,
      ageMinutes: Math.floor((now.getTime() - f.createdAt.getTime()) / 60_000),
      createdAt: f.createdAt.toISOString(),
    };
  }

  /** Oldest first: timely handling matters. */
  async listFlags(c: { status: "open" | "resolved"; limit: number; offset: number }) {
    const page = await this.flags.search(c);
    const now = this.clock.now();
    const items = await Promise.all(
      page.items.map(async (f) => this.flagRow(f, now, (await this.flags.openFor(f.targetType, f.targetId)).length)),
    );
    return { items, total: page.total };
  }

  private async resolveOpenFlags(type: Flag["targetType"], targetId: string, outcome: FlagOutcome, notes: string) {
    const open = await this.flags.openFor(type, targetId);
    const now = this.clock.now();
    for (const f of open) await this.flags.save({ ...f, status: "resolved", outcome, notes, resolvedAt: now });
    return open.length;
  }

  async resolveFlag(admin: Principal, number: number, d: { outcome: FlagOutcome; notes: string }) {
    const flag = await this.flags.findByNumber(number);
    if (!flag) throw new NotFoundError("Flag not found");
    if (flag.status === "resolved") throw new ConflictError("This flag is already resolved");

    const authorId = await this.authorOf(flag);
    if (d.outcome === "hide") {
      if (flag.targetType === "report") {
        const r = await this.reports.findById(flag.targetId);
        if (r && r.state !== "removed") await this.reports.save(withOpenFlags(hide(r, "admin", d.notes), 0));
      } else if (flag.targetType === "update") {
        const u = await this.updates.findById(flag.targetId);
        if (u) await this.updates.save({ ...hideUpdate(u, "admin"), openFlags: 0 });
      } else {
        throw new ValidationError("Users have no content to hide; warn or restrict them instead");
      }
    } else if (d.outcome === "none") {
      // Reviewed and fine: bring back anything the community auto-hid.
      if (flag.targetType === "report") {
        const r = await this.reports.findById(flag.targetId);
        if (r) await this.reports.save(withOpenFlags(r.hiddenBy === "auto" ? restore(r) : r, 0));
      } else if (flag.targetType === "update") {
        const u = await this.updates.findById(flag.targetId);
        if (u) await this.updates.save({ ...(u.hiddenBy === "auto" ? restoreUpdate(u) : u), openFlags: 0 });
      }
    } else {
      if (!authorId) throw new ValidationError("The author of this content no longer exists");
      await this.contributors.sanction(authorId, d.outcome);
    }

    const resolved = await this.resolveOpenFlags(flag.targetType, flag.targetId, d.outcome, d.notes);
    await this.audit.record({
      actor: actorOf(admin),
      action: "flag.resolve",
      target: `#${flag.number}`,
      reason: d.notes,
      metadata: { outcome: d.outcome, resolvedFlags: resolved, targetRef: flag.targetRef },
    });
    return { number: flag.number, outcome: d.outcome, resolvedFlags: resolved };
  }

  private async authorOf(flag: Flag): Promise<string | null> {
    if (flag.targetType === "user") return flag.targetId;
    if (flag.targetType === "report") return (await this.reports.findById(flag.targetId))?.reporterId ?? null;
    return (await this.updates.findById(flag.targetId))?.authorId ?? null;
  }
}
