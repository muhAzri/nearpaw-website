import type { AuditRecorder } from "@/backend/shared/application/audit";
import { systemClock, type Clock } from "@/backend/shared/application/clock";
import { singleton } from "@/backend/shared/infrastructure/singleton";
import type { Authenticator } from "@/backend/shared/presentation/auth";
import { FlagService } from "./application/flag.usecases";
import { ModerationService } from "./application/moderation.usecases";
import type { ContributorDirectory, LimitsReader, RegionDirectory, ReportEvents } from "./application/ports";
import { ReportService } from "./application/report.usecases";
import { ReportStats } from "./application/stats.usecases";
import {
  InMemoryFlagRepository,
  InMemoryReportRepository,
  InMemoryUpdateRepository,
} from "./infrastructure/in-memory.repositories";
import { ModerationController } from "./presentation/moderation.controller";
import { ReportsController } from "./presentation/reports.controller";

export function createReportsModule(deps: {
  auth: Authenticator;
  audit: AuditRecorder;
  contributors: ContributorDirectory;
  regions: RegionDirectory;
  limits: LimitsReader;
  events: ReportEvents;
  clock?: Clock;
}) {
  const clock = deps.clock ?? systemClock;
  const reports = singleton("reports_repo", () => new InMemoryReportRepository());
  const updates = singleton("updates_repo", () => new InMemoryUpdateRepository());
  const flags = singleton("flags_repo", () => new InMemoryFlagRepository());

  const stats = new ReportStats(reports, updates, flags, clock);
  return {
    stats,
    reportsController: new ReportsController(
      deps.auth,
      new ReportService(reports, updates, deps.contributors, deps.regions, deps.limits, deps.events, clock),
      new FlagService(flags, reports, updates, deps.contributors, deps.limits, deps.audit, clock),
    ),
    moderationController: new ModerationController(
      deps.auth,
      new ModerationService(reports, updates, flags, deps.contributors, deps.audit, clock),
      stats,
    ),
  };
}
