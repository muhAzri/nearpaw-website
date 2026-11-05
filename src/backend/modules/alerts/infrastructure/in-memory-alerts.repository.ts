import type { Page } from "@/backend/shared/domain/page";
import type { AlertItem, AlertSettings } from "../domain/alert";
import type { AlertRepository } from "../domain/repositories";
import type { PushNotifier } from "../application/alerts.usecases";

export class InMemoryAlertRepository implements AlertRepository {
  private readonly settings = new Map<string, AlertSettings>();
  private items: AlertItem[] = [];
  private readonly deviceTokens = new Map<string, Set<string>>();

  async getSettings(userId: string) {
    return this.settings.get(userId) ?? null;
  }
  async saveSettings(s: AlertSettings) {
    this.settings.set(s.userId, s);
  }
  async allSettings() {
    return [...this.settings.values()];
  }

  async addItem(item: AlertItem) {
    this.items.push(item);
  }
  async listItems(userId: string, o: { unreadOnly: boolean; limit: number; offset: number }): Promise<Page<AlertItem>> {
    const hits = this.items
      .filter((i) => i.userId === userId && (!o.unreadOnly || !i.read))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { items: hits.slice(o.offset, o.offset + o.limit), total: hits.length };
  }
  async unreadCount(userId: string) {
    return this.items.filter((i) => i.userId === userId && !i.read).length;
  }
  async markRead(userId: string, ids?: string[]) {
    this.items = this.items.map((i) => (i.userId === userId && (!ids || ids.includes(i.id)) ? { ...i, read: true } : i));
  }
  async deliveryStats(since: Date) {
    const recent = this.items.filter((i) => i.createdAt >= since);
    return { sent: recent.filter((i) => i.delivery === "sent").length, failed: recent.filter((i) => i.delivery === "failed").length };
  }

  async saveDevice(userId: string, token: string) {
    const set = this.deviceTokens.get(userId) ?? new Set<string>();
    set.add(token);
    this.deviceTokens.set(userId, set);
  }
  async removeDevice(userId: string, token: string) {
    this.deviceTokens.get(userId)?.delete(token);
  }
  async devices(userId: string) {
    return [...(this.deviceTokens.get(userId) ?? [])];
  }

  async deleteUser(userId: string) {
    this.settings.delete(userId);
    this.deviceTokens.delete(userId);
    this.items = this.items.filter((i) => i.userId !== userId);
  }
}

/**
 * Placeholder until APNs credentials exist: reports "not delivered" so the dashboard's
 * failed counter is honest instead of pretending a push went out.
 */
export class UnconfiguredPushNotifier implements PushNotifier {
  async send() {
    return false;
  }
}
