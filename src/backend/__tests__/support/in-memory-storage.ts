import type { BackendOverrides } from "../../composition";
import type { Storage } from "../../storage";
import { InMemoryAlertRepository } from "./in-memory-alerts";
import { InMemoryAuditRepository } from "./in-memory-audit";
import { FakeAuthProvider } from "./fake-auth-provider";
import { InMemoryBlockRepository, InMemoryUserRepository } from "./in-memory-identity";
import { InMemoryImpactRepository } from "./in-memory-impact";
import { InMemoryLoginAttempts } from "./in-memory-login-attempts";
import { InMemoryRateLimiter } from "./in-memory-rate-limiter";
import { InMemoryAdPlacementRepository, InMemoryConfigRepository, InMemoryRegionRepository } from "./in-memory-regions";
import { InMemoryFlagRepository, InMemoryReportRepository, InMemoryUpdateRepository } from "./in-memory-reports";
import { InMemorySupportRepository } from "./in-memory-support";

/** Test doubles for the whole backend. They live here on purpose: the API itself keeps nothing in memory. */
export function inMemoryBackend(): { overrides: BackendOverrides; auth: FakeAuthProvider } {
  const auth = new FakeAuthProvider(false);
  const storage: Storage = {
    users: new InMemoryUserRepository(),
    blocks: new InMemoryBlockRepository(),
    loginAttempts: new InMemoryLoginAttempts(),
    alerts: new InMemoryAlertRepository(),
    reports: new InMemoryReportRepository(),
    updates: new InMemoryUpdateRepository(),
    flags: new InMemoryFlagRepository(),
    regions: new InMemoryRegionRepository(),
    config: new InMemoryConfigRepository(),
    placements: new InMemoryAdPlacementRepository(),
    impact: new InMemoryImpactRepository(),
    support: new InMemorySupportRepository(),
    audit: new InMemoryAuditRepository(),
    rateLimiter: new InMemoryRateLimiter(),
  };
  return { overrides: { storage, auth: { credentials: auth, verifier: auth.verifier } }, auth };
}
