import type { Authenticator } from "@/backend/shared/presentation/auth";
import { DashboardQuery, type DashboardSources } from "./application/dashboard.usecases";
import { DashboardController } from "./presentation/dashboard.controller";

export function createAdminModule(deps: { auth: Authenticator; sources: DashboardSources }) {
  return { dashboard: new DashboardController(deps.auth, new DashboardQuery(deps.sources)) };
}
