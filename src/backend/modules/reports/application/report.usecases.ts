import type { Clock } from "@/backend/shared/application/clock";
import { HOUR_MS } from "@/backend/shared/application/clock";
import { ForbiddenError, NotFoundError, RateLimitedError, ValidationError } from "@/backend/shared/domain/errors";
import type { GeoPoint } from "@/backend/shared/domain/geo";
import type { Principal } from "@/backend/shared/domain/principal";
import { createUpdate, type UpdateType } from "../domain/community-update";
import {
  close,
  createReport,
  edit,
  effectiveState,
  isPubliclyVisible,
  type Animal,
  type Condition,
  type Report,
  type Urgency,
} from "../domain/report";
import type { ReportRepository, UpdateRepository } from "../domain/repositories";
import { toSummary, toUpdateDto } from "./dto";
import type { ContributorDirectory, LimitsReader, RegionDirectory, ReportEvents } from "./ports";
import { reportTitle } from "../domain/report";

export interface CreateReportCommand {
  animal: Animal;
  condition: Condition;
  urgency: Urgency;
  description: string;
  photos: string[];
  location: GeoPoint;
  locationLabel?: string;
  areaName?: string;
  language: "en" | "id";
}

export interface ListReportsCommand {
  center?: GeoPoint;
  radiusKm: number;
  sort: "nearby" | "latest" | "urgent";
  animals?: Animal[];
  conditions?: Condition[];
  sinceDays?: number;
  state: "live" | "closed";
  limit: number;
  offset: number;
}

export class ReportService {
  constructor(
    private readonly reports: ReportRepository,
    private readonly updates: UpdateRepository,
    private readonly contributors: ContributorDirectory,
    private readonly regions: RegionDirectory,
    private readonly limits: LimitsReader,
    private readonly events: ReportEvents,
    private readonly clock: Clock,
  ) {}

  async create(user: Principal, cmd: CreateReportCommand) {
    await this.contributors.assertCanContribute(user.id);
    const now = this.clock.now();

    // Reporting works anywhere. Regions are optional: they only override expiry, and gate
    // reporting when the operator turns `restrictToRegions` on.
    const region = await this.regions.findActiveContaining(cmd.location);
    if (!region && (await this.limits.featureFlags()).restrictToRegions) {
      throw new ValidationError("Reporting isn't open at this location yet", { location: cmd.location });
    }

    const { reportsPerUserPerHour, reportExpiryDays } = await this.limits.safetyLimits();
    const recent = await this.reports.countByReporterSince(user.id, new Date(now.getTime() - HOUR_MS));
    if (recent >= reportsPerUserPerHour) {
      throw new RateLimitedError("You've reached the hourly report limit. Please try again later.");
    }

    const report = createReport({ ...cmd, reporterId: user.id, region, expiryDays: region?.defaultExpiryDays ?? reportExpiryDays, now });
    await this.reports.add(report);
    await this.events.published({
      id: report.id,
      ref: report.ref,
      title: reportTitle(report),
      animal: report.animal,
      urgency: report.urgency,
      location: report.location,
      locationLabel: report.locationLabel,
      reporterId: report.reporterId,
    });
    return { ref: report.ref, state: report.state, visibleAs: "exact_pin" as const, createdAt: report.createdAt.toISOString() };
  }

  async list(viewer: Principal | null, cmd: ListReportsCommand) {
    if (cmd.sort === "nearby" && !cmd.center) throw new ValidationError("lat and lng are required to sort by distance");
    const now = this.clock.now();
    const blocked = viewer ? [...(await this.contributors.blockedIds(viewer.id))] : [];
    const page = await this.reports.search({
      now,
      states: [cmd.state],
      animals: cmd.animals,
      conditions: cmd.conditions,
      excludeReporterIds: blocked,
      center: cmd.center,
      radiusKm: cmd.center ? cmd.radiusKm : undefined,
      createdAfter: cmd.sinceDays ? new Date(now.getTime() - cmd.sinceDays * 86_400_000) : undefined,
      sort: cmd.sort,
      limit: cmd.limit,
      offset: cmd.offset,
    });
    const items = await Promise.all(
      page.items.map(async (r) =>
        toSummary(r, now, {
          from: cmd.center,
          mine: viewer?.id === r.reporterId,
          updateCount: (await this.updates.listByReport(r.id)).filter((u) => u.state === "live").length,
        }),
      ),
    );
    return { items, total: page.total };
  }

  private async visibleTo(viewer: Principal | null, ref: string): Promise<Report> {
    const report = await this.reports.findByRef(ref);
    const now = this.clock.now();
    const isOwner = !!viewer && report?.reporterId === viewer.id;
    if (!report || (!isPubliclyVisible(report, now) && !isOwner)) throw new NotFoundError("This report is no longer available.");
    if (viewer && !isOwner && (await this.contributors.blockedIds(viewer.id)).has(report.reporterId)) {
      throw new NotFoundError("This report is no longer available.");
    }
    return report;
  }

  async detail(viewer: Principal | null, ref: string, from?: GeoPoint) {
    const report = await this.visibleTo(viewer, ref);
    const now = this.clock.now();
    const { communityUpdates } = await this.limits.featureFlags();
    const blocked = viewer ? await this.contributors.blockedIds(viewer.id) : new Set<string>();
    const updates = communityUpdates
      ? (await this.updates.listByReport(report.id)).filter((u) => u.state === "live" && !blocked.has(u.authorId))
      : [];
    const mine = viewer?.id === report.reporterId;
    return {
      ...toSummary(report, now, { from, mine, updateCount: updates.length }),
      description: report.description,
      photos: report.photos,
      expiresAt: report.expiresAt.toISOString(),
      urgencyNote: "Urgency is the reporter's own assessment.",
      updates: updates.map(toUpdateDto),
      canAddUpdate: communityUpdates && effectiveState(report, now) === "live",
    };
  }

  /** Public share page: coarse area only, never the pin, photos or updates. */
  async shared(ref: string) {
    const report = await this.reports.findByRef(ref);
    const now = this.clock.now();
    if (!report || effectiveState(report, now) !== "live") throw new NotFoundError("This report is no longer available.");
    return {
      ref: report.ref,
      title: reportTitle(report),
      urgency: report.urgency,
      state: "live" as const,
      area: report.areaName,
      createdAt: report.createdAt.toISOString(),
    };
  }

  // ---- reporter's own ----
  async mine(user: Principal) {
    const now = this.clock.now();
    const own = (await this.reports.listByReporter(user.id)).filter((r) => r.state !== "removed");
    return own
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((r) => toSummary(r, now, { mine: true }));
  }

  private async owned(user: Principal, ref: string): Promise<Report> {
    const report = await this.reports.findByRef(ref);
    if (!report || report.reporterId !== user.id || report.state === "removed") throw new NotFoundError("Report not found");
    return report;
  }

  async myDetail(user: Principal, ref: string) {
    const report = await this.owned(user, ref);
    const now = this.clock.now();
    const updates = (await this.updates.listByReport(report.id)).filter((u) => u.state === "live");
    const history = [{ label: "Live on the map", at: report.createdAt.toISOString() }];
    for (const u of updates) history.push({ label: "Community update (not verified)", at: u.createdAt.toISOString() });
    if (report.closedAt) history.push({ label: "Closed by you", at: report.closedAt.toISOString() });
    return {
      ...toSummary(report, now, { mine: true, updateCount: updates.length }),
      description: report.description,
      photos: report.photos,
      expiresAt: report.expiresAt.toISOString(),
      moderation: report.state === "hidden" ? { hidden: true, by: report.hiddenBy === "auto" ? "community flags" : "moderators" } : { hidden: false },
      history,
    };
  }

  async edit(user: Principal, ref: string, patch: { description?: string; urgency?: Urgency; condition?: Condition }) {
    const report = await this.owned(user, ref);
    await this.contributors.assertCanContribute(user.id);
    await this.reports.save(edit(report, patch, this.clock.now()));
    return this.myDetail(user, ref);
  }

  async close(user: Principal, ref: string) {
    const report = await this.owned(user, ref);
    await this.reports.save(close(report, this.clock.now()));
  }

  // ---- community updates ----
  async addUpdate(user: Principal, ref: string, input: { type: UpdateType; note?: string; photos: string[] }) {
    await this.contributors.assertCanContribute(user.id);
    if (!(await this.limits.featureFlags()).communityUpdates) throw new ForbiddenError("Community updates are turned off");
    const report = await this.reports.findByRef(ref);
    const now = this.clock.now();
    if (!report || !isPubliclyVisible(report, now)) throw new NotFoundError("This report is no longer available.");

    const { updatesPerUserPerHour } = await this.limits.safetyLimits();
    if ((await this.updates.countByAuthorSince(user.id, new Date(now.getTime() - HOUR_MS))) >= updatesPerUserPerHour) {
      throw new RateLimitedError("You've reached the hourly update limit. Please try again later.");
    }
    const update = createUpdate(report, { ...input, authorId: user.id, now });
    await this.updates.add(update);
    return toUpdateDto(update);
  }

  async myUpdates(user: Principal) {
    const updates = (await this.updates.listByAuthor(user.id)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return Promise.all(
      updates.map(async (u) => {
        const report = await this.reports.findById(u.reportId);
        return {
          ...toUpdateDto(u),
          status: u.state === "live" ? ("posted" as const) : ("hidden" as const),
          report: report ? { ref: report.ref, title: reportTitle(report), locationLabel: report.locationLabel } : null,
        };
      }),
    );
  }

  async blockReporter(user: Principal, ref: string) {
    await this.contributors.assertCanContribute(user.id);
    const report = await this.reports.findByRef(ref);
    if (!report) throw new NotFoundError("Report not found");
    await this.contributors.block(user.id, report.reporterId);
  }
}
