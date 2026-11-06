import { systemClock, type Clock } from "@/backend/shared/application/clock";
import { serverEnv } from "@/backend/shared/config/env";
import type { Authenticator } from "@/backend/shared/presentation/auth";
import { AlertsService, type AlertsPolicy, type PushNotifier } from "./application/alerts.usecases";
import type { AlertRepository } from "./domain/repositories";
import { UnconfiguredPushNotifier } from "./infrastructure/unconfigured-push-notifier";
import { FcmPushNotifier, fcmFromServiceAccount } from "./infrastructure/fcm-push-notifier";
import { AlertsController } from "./presentation/alerts.controller";

/** FCM when a service account is configured; otherwise pushes are skipped and reported as not delivered. */
function pushFromEnv(): PushNotifier {
  const env = serverEnv();
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) return new UnconfiguredPushNotifier();
  try {
    return new FcmPushNotifier(fcmFromServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID));
  } catch (error) {
    console.error("[push] invalid Firebase configuration; pushes are disabled", error);
    return new UnconfiguredPushNotifier();
  }
}

export function createAlertsModule(deps: { auth: Authenticator; policy: AlertsPolicy; repo: AlertRepository; push?: PushNotifier; clock?: Clock }) {
  const service = new AlertsService(deps.repo, deps.push ?? pushFromEnv(), deps.policy, deps.clock ?? systemClock);
  return { service, controller: new AlertsController(deps.auth, service) };
}
