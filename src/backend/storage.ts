import type { SupabaseClient } from "@supabase/supabase-js";
import type { RateLimiter } from "./shared/application/rate-limiter";
import { SupabaseRateLimiter } from "./shared/infrastructure/rate-limiter";
import type { AlertRepository } from "./modules/alerts/domain/repositories";
import { SupabaseAlertRepository } from "./modules/alerts/infrastructure/supabase-alerts.repository";
import type { AuditRepository } from "./modules/audit/domain/audit-record";
import { SupabaseAuditRepository } from "./modules/audit/infrastructure/supabase-audit.repository";
import type { LoginAttemptStore } from "./modules/identity/application/ports";
import type { BlockRepository, UserRepository } from "./modules/identity/domain/repositories";
import { SupabaseBlockRepository } from "./modules/identity/infrastructure/supabase-block.repository";
import { SupabaseLoginAttempts } from "./modules/identity/infrastructure/supabase-login-attempts";
import { SupabaseUserRepository } from "./modules/identity/infrastructure/supabase-user.repository";
import type { ImpactRepository } from "./modules/impact/domain/repositories";
import { SupabaseImpactRepository } from "./modules/impact/infrastructure/supabase-impact.repository";
import type { AdPlacementRepository, ConfigRepository, RegionRepository } from "./modules/regions/domain/repositories";
import { SupabaseAdPlacementRepository, SupabaseConfigRepository, SupabaseRegionRepository } from "./modules/regions/infrastructure/supabase-regions.repository";
import type { FlagRepository, ReportRepository, UpdateRepository } from "./modules/reports/domain/repositories";
import { SupabaseFlagRepository, SupabaseReportRepository, SupabaseUpdateRepository } from "./modules/reports/infrastructure/supabase-reports.repository";
import type { SupportRepository } from "./modules/support/domain/repositories";
import { SupabaseSupportRepository } from "./modules/support/infrastructure/supabase-support.repository";

/** Everything the API persists. Supabase is the single source of truth; tests pass their own doubles. */
export interface Storage {
  users: UserRepository;
  blocks: BlockRepository;
  loginAttempts: LoginAttemptStore;
  alerts: AlertRepository;
  reports: ReportRepository;
  updates: UpdateRepository;
  flags: FlagRepository;
  regions: RegionRepository;
  config: ConfigRepository;
  placements: AdPlacementRepository;
  impact: ImpactRepository;
  support: SupportRepository;
  audit: AuditRepository;
  rateLimiter: RateLimiter;
}

export function supabaseStorage(db: SupabaseClient): Storage {
  return {
    users: new SupabaseUserRepository(db),
    blocks: new SupabaseBlockRepository(db),
    loginAttempts: new SupabaseLoginAttempts(db),
    alerts: new SupabaseAlertRepository(db),
    reports: new SupabaseReportRepository(db),
    updates: new SupabaseUpdateRepository(db),
    flags: new SupabaseFlagRepository(db),
    regions: new SupabaseRegionRepository(db),
    config: new SupabaseConfigRepository(db),
    placements: new SupabaseAdPlacementRepository(db),
    impact: new SupabaseImpactRepository(db),
    support: new SupabaseSupportRepository(db),
    audit: new SupabaseAuditRepository(db),
    rateLimiter: new SupabaseRateLimiter(db),
  };
}
