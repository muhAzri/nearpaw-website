import type { Page } from "@/backend/shared/domain/page";
import type { AlertItem, AlertSettings } from "./alert";

export interface AlertRepository {
  getSettings(userId: string): Promise<AlertSettings | null>;
  saveSettings(settings: AlertSettings): Promise<void>;
  allSettings(): Promise<AlertSettings[]>;

  addItem(item: AlertItem): Promise<void>;
  listItems(userId: string, opts: { unreadOnly: boolean; limit: number; offset: number }): Promise<Page<AlertItem>>;
  unreadCount(userId: string): Promise<number>;
  markRead(userId: string, ids?: string[]): Promise<void>;
  deliveryStats(since: Date): Promise<{ sent: number; failed: number }>;

  saveDevice(userId: string, token: string): Promise<void>;
  removeDevice(userId: string, token: string): Promise<void>;
  devices(userId: string): Promise<string[]>;

  deleteUser(userId: string): Promise<void>;
}
