import type { Clock } from "@/backend/shared/application/clock";
import { ForbiddenError } from "@/backend/shared/domain/errors";
import type { Principal } from "@/backend/shared/domain/principal";
import { publicText } from "@/backend/shared/domain/text";
import { defaultSettings, matchDistance, type AlertItem, type AlertRadius, type AlertSettings, type ReportForAlert } from "../domain/alert";
import type { AlertRepository } from "../domain/repositories";

export interface PushNotifier {
  /** Resolves true when handed to the push provider. */
  send(deviceTokens: string[], message: { title: string; body: string; data: Record<string, string> }): Promise<boolean>;
}

export interface AlertsPolicy {
  alertsEnabled(): Promise<boolean>;
  blockedIds(userId: string): Promise<Set<string>>;
}

const toDto = (s: AlertSettings) => ({ enabled: s.enabled, area: s.area, radiusKm: s.radiusKm, animals: [...s.animals] });

const itemDto = (i: AlertItem) => ({
  id: i.id,
  reportRef: i.reportRef,
  title: i.title,
  urgency: i.urgency,
  locationLabel: i.locationLabel,
  distanceKm: Math.round(i.distanceKm * 10) / 10,
  read: i.read,
  createdAt: i.createdAt.toISOString(),
});

export class AlertsService {
  constructor(
    private readonly repo: AlertRepository,
    private readonly push: PushNotifier,
    private readonly policy: AlertsPolicy,
    private readonly clock: Clock,
  ) {}

  async settings(user: Principal) {
    return toDto((await this.repo.getSettings(user.id)) ?? defaultSettings(user.id));
  }

  async updateSettings(
    user: Principal,
    input: { enabled: boolean; area: { label: string; lat: number; lng: number } | null; radiusKm: AlertRadius; animals: string[] },
  ) {
    if (!(await this.policy.alertsEnabled())) throw new ForbiddenError("Nearby alerts are not available right now");
    const next: AlertSettings = {
      userId: user.id,
      ...input,
      area: input.area ? { ...input.area, label: publicText(input.area.label, "Area", { min: 2, max: 120 }) } : null,
      // Alerts need somewhere to be about.
      enabled: input.enabled && !!input.area,
    };
    await this.repo.saveSettings(next);
    return toDto(next);
  }

  async registerDevice(user: Principal, token: string) {
    await this.repo.saveDevice(user.id, token);
  }

  async unregisterDevice(user: Principal, token: string) {
    await this.repo.removeDevice(user.id, token);
  }

  async feed(user: Principal, opts: { unreadOnly: boolean; limit: number; offset: number }) {
    const [settings, page, unread] = await Promise.all([
      this.settings(user),
      this.repo.listItems(user.id, opts),
      this.repo.unreadCount(user.id),
    ]);
    return { settings, unread, items: page.items.map(itemDto), total: page.total };
  }

  async markRead(user: Principal, ids?: string[]) {
    await this.repo.markRead(user.id, ids);
  }

  /** Called when a report is published; fans out to everyone whose alert area matches. */
  async onReportPublished(report: ReportForAlert): Promise<void> {
    if (!(await this.policy.alertsEnabled())) return;
    const now = this.clock.now();
    for (const settings of await this.repo.allSettings()) {
      const distance = matchDistance(settings, report);
      if (distance === null) continue;
      if ((await this.policy.blockedIds(settings.userId)).has(report.reporterId)) continue;

      const tokens = await this.repo.devices(settings.userId);
      let delivery: AlertItem["delivery"] = "skipped";
      if (tokens.length > 0) {
        // A broken push provider must never block publishing a report.
        delivery = (await this.push
          .send(tokens, {
            title: "Nearpaw",
            body: `A new report was posted near ${settings.area?.label ?? "your area"}.`,
            data: { ref: report.ref },
          })
          .catch(() => false))
          ? "sent"
          : "failed";
      }
      await this.repo.addItem({
        id: crypto.randomUUID(),
        userId: settings.userId,
        reportRef: report.ref,
        title: report.title,
        urgency: report.urgency,
        locationLabel: report.locationLabel,
        distanceKm: distance,
        read: false,
        delivery,
        createdAt: now,
      });
    }
  }

  async stats24h() {
    return this.repo.deliveryStats(new Date(this.clock.now().getTime() - 86_400_000));
  }

  async removeUserData(userId: string) {
    await this.repo.deleteUser(userId);
  }
}
