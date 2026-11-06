import type { PushNotifier } from "../application/alerts.usecases";

/**
 * Used until Firebase credentials exist: reports "not delivered" so the dashboard's
 * failed counter is honest instead of pretending a push went out.
 */
export class UnconfiguredPushNotifier implements PushNotifier {
  async send() {
    return { delivered: false, invalidTokens: [] };
  }
}
