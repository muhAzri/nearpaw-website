import type { AuditRecorder } from "@/backend/shared/application/audit";
import { mediaUrlFor } from "@/backend/shared/domain/media-key";
import { systemClock, type Clock } from "@/backend/shared/application/clock";
import type { Authenticator } from "@/backend/shared/presentation/auth";
import { FlagService } from "./application/flag.usecases";
import { ModerationService } from "./application/moderation.usecases";
import { PhotoRetention } from "./application/photo-retention";
import type { ContributorDirectory, LimitsReader, PhotoEraser, RegionDirectory, ReportEvents } from "./application/ports";
import { ReportService } from "./application/report.usecases";
import { ReportStats } from "./application/stats.usecases";
import type { FlagRepository, ReportRepository, UpdateRepository } from "./domain/repositories";
import { ModerationController } from "./presentation/moderation.controller";
import { ReportsController } from "./presentation/reports.controller";

export function createReportsModule(deps: {
  auth: Authenticator;
  audit: AuditRecorder;
  contributors: ContributorDirectory;
  regions: RegionDirectory;
  limits: LimitsReader;
  events: ReportEvents;
  photos: PhotoEraser;
  repos: { reports: ReportRepository; updates: UpdateRepository; flags: FlagRepository };
  clock?: Clock;
  /** Where `public/…` photo keys are served from (`S3_PUBLIC_BASE_URL`). */
  mediaBaseUrl?: string;
}) {
  const clock = deps.clock ?? systemClock;
  const { reports, updates, flags } = deps.repos;

  const mediaUrl = mediaUrlFor(deps.mediaBaseUrl);
  const stats = new ReportStats(reports, updates, flags, clock);
  return {
    stats,
    photoRetention: new PhotoRetention(reports, updates, deps.photos),
    reportsController: new ReportsController(
      deps.auth,
      new ReportService(reports, updates, deps.contributors, deps.regions, deps.limits, deps.events, clock, mediaUrl),
      new FlagService(flags, reports, updates, deps.contributors, deps.limits, deps.audit, clock),
    ),
    moderationController: new ModerationController(
      deps.auth,
      new ModerationService(reports, updates, flags, deps.contributors, deps.audit, clock, mediaUrl),
      stats,
    ),
  };
}
