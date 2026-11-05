import { singleton } from "@/backend/shared/infrastructure/singleton";
import type { Authenticator } from "@/backend/shared/presentation/auth";
import { createAdminModule } from "@/backend/modules/admin";
import { createAlertsModule } from "@/backend/modules/alerts";
import { createAuditModule } from "@/backend/modules/audit";
import { createIdentityModule } from "@/backend/modules/identity";
import { createImpactModule } from "@/backend/modules/impact";
import { createRegionsModule } from "@/backend/modules/regions";
import { createReportsModule } from "@/backend/modules/reports";
import { createSupportModule } from "@/backend/modules/support";

/**
 * Composition root: the only place where modules meet. Each module talks to the others through
 * small ports defined by the consumer, so any module can later move behind its own service.
 */
function compose() {
  // Identity is built after audit but everyone needs its authenticator, hence the late binding.
  const late: { authenticator?: Authenticator } = {};
  const auth: Authenticator = {
    authenticate: (token) => {
      if (!late.authenticator) throw new Error("Authenticator is not ready");
      return late.authenticator.authenticate(token);
    },
  };

  const audit = createAuditModule({ auth });
  const identity = createIdentityModule({ audit: audit.recorder });
  late.authenticator = identity.authenticator;

  const regions = createRegionsModule({ auth, audit: audit.recorder });

  const alerts = createAlertsModule({
    auth,
    policy: {
      alertsEnabled: async () => (await regions.queries.featureFlags()).nearbyAlerts,
      blockedIds: (userId) => identity.queries.blockedIds(userId),
    },
  });

  const reports = createReportsModule({
    auth,
    audit: audit.recorder,
    contributors: identity.queries,
    regions: regions.queries,
    limits: regions.queries,
    // Alerts must never make publishing a report fail.
    events: {
      published: (report) =>
        alerts.service.onReportPublished(report).catch((error) => {
          console.error("[alerts] fan-out failed", error);
        }),
    },
  });

  const identityController = identity.build({
    cleaner: {
      handleReports: (userId, mode) => reports.stats.handleDeletedAccount(userId, mode),
      removeAlertData: (userId) => alerts.service.removeUserData(userId),
    },
    activity: { activity: (userId) => reports.stats.userActivity(userId) },
  });

  const impact = createImpactModule({ auth, audit: audit.recorder });
  const support = createSupportModule({ auth, audit: audit.recorder });
  const admin = createAdminModule({
    auth,
    sources: {
      reports: reports.stats,
      alerts: alerts.service,
      support,
      audit: audit.recent,
    },
  });

  return {
    identity: identityController,
    audit: audit.controller,
    regions: regions.controller,
    reports: reports.reportsController,
    moderation: reports.moderationController,
    alerts: alerts.controller,
    impact: impact.controller,
    support: support.controller,
    dashboard: admin.dashboard,
  };
}

export type Backend = ReturnType<typeof compose>;

/** Lazily built so `next build` doesn't need runtime configuration. */
export const backend = (): Backend => singleton("backend", compose);
