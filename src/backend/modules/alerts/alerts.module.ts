import { systemClock, type Clock } from "@/backend/shared/application/clock";
import { singleton } from "@/backend/shared/infrastructure/singleton";
import type { Authenticator } from "@/backend/shared/presentation/auth";
import { AlertsService, type AlertsPolicy, type PushNotifier } from "./application/alerts.usecases";
import { InMemoryAlertRepository, UnconfiguredPushNotifier } from "./infrastructure/in-memory-alerts.repository";
import { AlertsController } from "./presentation/alerts.controller";

export function createAlertsModule(deps: { auth: Authenticator; policy: AlertsPolicy; push?: PushNotifier; clock?: Clock }) {
  const repo = singleton("alerts_repo", () => new InMemoryAlertRepository());
  const service = new AlertsService(repo, deps.push ?? new UnconfiguredPushNotifier(), deps.policy, deps.clock ?? systemClock);
  return { service, controller: new AlertsController(deps.auth, service) };
}
