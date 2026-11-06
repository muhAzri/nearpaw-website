import { serverEnv } from "@/backend/shared/config/env";
import { singleton } from "@/backend/shared/infrastructure/singleton";
import { supabaseAdmin } from "@/backend/shared/infrastructure/supabase-admin";
import { supabaseStorage, type Storage } from "./storage";
import type { Authenticator } from "@/backend/shared/presentation/auth";
import { createAdminModule } from "@/backend/modules/admin";
import { createAlertsModule } from "@/backend/modules/alerts";
import { createAuditModule } from "@/backend/modules/audit";
import { createIdentityModule, supabaseAuthFromEnv, type AuthBackend } from "@/backend/modules/identity";
import { createMediaModule } from "@/backend/modules/media";
import { createImpactModule } from "@/backend/modules/impact";
import { createRegionsModule } from "@/backend/modules/regions";
import { createReportsModule } from "@/backend/modules/reports";
import { createSupportModule } from "@/backend/modules/support";

/**
 * Composition root: the only place where modules meet. Each module talks to the others through
 * small ports defined by the consumer, so any module can later move behind its own service.
 */
export interface BackendOverrides {
  storage?: Storage;
  auth?: AuthBackend;
}

function compose(overrides: BackendOverrides = {}) {
  const storage = overrides.storage ?? supabaseStorage(supabaseAdmin());
  const authBackend = overrides.auth ?? supabaseAuthFromEnv();

  // Identity is built after audit but everyone needs its authenticator, hence the late binding.
  const late: { authenticator?: Authenticator } = {};
  const auth: Authenticator = {
    authenticate: (token) => {
      if (!late.authenticator) throw new Error("Authenticator is not ready");
      return late.authenticator.authenticate(token);
    },
  };

  const audit = createAuditModule({ auth, repo: storage.audit });
  const identity = createIdentityModule({
    audit: audit.recorder,
    repos: { users: storage.users, blocks: storage.blocks, loginAttempts: storage.loginAttempts },
    limiter: storage.rateLimiter,
    auth: authBackend,
  });
  late.authenticator = identity.authenticator;

  const regions = createRegionsModule({ auth, audit: audit.recorder, repos: { regions: storage.regions, config: storage.config, placements: storage.placements }, mediaBaseUrl: serverEnv().S3_PUBLIC_BASE_URL });

  // Restricted or suspended accounts can't upload photos either.
  const media = createMediaModule({ auth, limiter: storage.rateLimiter, policy: { assertCanUpload: (userId) => identity.queries.assertCanContribute(userId) } });

  const alerts = createAlertsModule({
    auth,
    repo: storage.alerts,
    policy: {
      alertsEnabled: async () => (await regions.queries.featureFlags()).nearbyAlerts,
      blockedIds: (userId) => identity.queries.blockedIds(userId),
    },
  });

  const reports = createReportsModule({
    auth,
    repos: { reports: storage.reports, updates: storage.updates, flags: storage.flags },
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

  const impact = createImpactModule({ auth, audit: audit.recorder, repo: storage.impact });
  const support = createSupportModule({ auth, audit: audit.recorder, repo: storage.support, limiter: storage.rateLimiter });
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
    media: media.controller,
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
export const backend = (): Backend => singleton("backend", () => compose(singleton<BackendOverrides>("backend_overrides", () => ({}))));

/** Test seam: call before the first `backend()`. Production never sets overrides. */
export function useBackendOverrides(overrides: BackendOverrides): void {
  Object.assign(singleton<BackendOverrides>("backend_overrides", () => ({})), overrides);
}
