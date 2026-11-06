import type { SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@/backend/shared/domain/page";
import { check, unwrap } from "@/backend/shared/infrastructure/supabase-admin";
import type { AlertItem, AlertRadius, AlertSettings } from "../domain/alert";
import type { AlertRepository } from "../domain/repositories";

export interface SettingsRow {
  user_id: string;
  enabled: boolean;
  area_label: string | null;
  area_lat: number | null;
  area_lng: number | null;
  radius_km: number;
  animals: string[];
}

export interface ItemRow {
  id: string;
  user_id: string;
  report_ref: string;
  title: string;
  urgency: string;
  location_label: string | null;
  distance_km: number;
  read: boolean;
  delivery: AlertItem["delivery"];
  created_at: string;
}

export const settingsFromRow = (r: SettingsRow): AlertSettings => ({
  userId: r.user_id,
  enabled: r.enabled,
  area: r.area_label !== null && r.area_lat !== null && r.area_lng !== null ? { label: r.area_label, lat: r.area_lat, lng: r.area_lng } : null,
  radiusKm: r.radius_km as AlertRadius,
  animals: r.animals,
});

export const settingsToRow = (s: AlertSettings): SettingsRow => ({
  user_id: s.userId,
  enabled: s.enabled,
  area_label: s.area?.label ?? null,
  area_lat: s.area?.lat ?? null,
  area_lng: s.area?.lng ?? null,
  radius_km: s.radiusKm,
  animals: [...s.animals],
});

export const itemFromRow = (r: ItemRow): AlertItem => ({
  id: r.id,
  userId: r.user_id,
  reportRef: r.report_ref,
  title: r.title,
  urgency: r.urgency,
  locationLabel: r.location_label,
  distanceKm: r.distance_km,
  read: r.read,
  delivery: r.delivery,
  createdAt: new Date(r.created_at),
});

export const itemToRow = (i: AlertItem): ItemRow => ({
  id: i.id,
  user_id: i.userId,
  report_ref: i.reportRef,
  title: i.title,
  urgency: i.urgency,
  location_label: i.locationLabel,
  distance_km: i.distanceKm,
  read: i.read,
  delivery: i.delivery,
  created_at: i.createdAt.toISOString(),
});

/** `alert_settings`, `alert_items` and `devices` through the secret key. */
export class SupabaseAlertRepository implements AlertRepository {
  constructor(private readonly db: SupabaseClient) {}

  async getSettings(userId: string) {
    const row = unwrap(await this.db.from("alert_settings").select("*").eq("user_id", userId).maybeSingle<SettingsRow>(), "alerts.getSettings");
    return row ? settingsFromRow(row) : null;
  }

  async saveSettings(s: AlertSettings) {
    check(await this.db.from("alert_settings").upsert(settingsToRow(s), { onConflict: "user_id" }), "alerts.saveSettings");
  }

  async allSettings() {
    const rows = unwrap(await this.db.from("alert_settings").select("*").eq("enabled", true), "alerts.allSettings");
    return (rows as SettingsRow[]).map(settingsFromRow);
  }

  async addItem(item: AlertItem) {
    check(await this.db.from("alert_items").insert(itemToRow(item)), "alerts.addItem");
  }

  async listItems(userId: string, o: { unreadOnly: boolean; limit: number; offset: number }): Promise<Page<AlertItem>> {
    let query = this.db.from("alert_items").select("*", { count: "exact" }).eq("user_id", userId);
    if (o.unreadOnly) query = query.eq("read", false);
    const { data, error, count } = await query.order("created_at", { ascending: false }).range(o.offset, o.offset + o.limit - 1);
    if (error) throw new Error(`alerts.listItems: ${error.message}`);
    return { items: ((data ?? []) as ItemRow[]).map(itemFromRow), total: count ?? 0 };
  }

  async unreadCount(userId: string) {
    const { count, error } = await this.db.from("alert_items").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("read", false);
    if (error) throw new Error(`alerts.unreadCount: ${error.message}`);
    return count ?? 0;
  }

  async markRead(userId: string, ids?: string[]) {
    let query = this.db.from("alert_items").update({ read: true }).eq("user_id", userId);
    if (ids) query = query.in("id", ids);
    check(await query, "alerts.markRead");
  }

  async deliveryStats(since: Date) {
    const count = async (delivery: "sent" | "failed") => {
      const { count, error } = await this.db
        .from("alert_items")
        .select("*", { count: "exact", head: true })
        .gte("created_at", since.toISOString())
        .eq("delivery", delivery);
      if (error) throw new Error(`alerts.deliveryStats: ${error.message}`);
      return count ?? 0;
    };
    const [sent, failed] = await Promise.all([count("sent"), count("failed")]);
    return { sent, failed };
  }

  async saveDevice(userId: string, token: string) {
    check(await this.db.from("devices").upsert({ user_id: userId, token }, { onConflict: "user_id,token" }), "alerts.saveDevice");
  }

  async removeDevice(userId: string, token: string) {
    check(await this.db.from("devices").delete().eq("user_id", userId).eq("token", token), "alerts.removeDevice");
  }

  async devices(userId: string) {
    const rows = unwrap(await this.db.from("devices").select("token").eq("user_id", userId), "alerts.devices");
    return (rows as { token: string }[]).map((r) => r.token);
  }

  async deleteUser(userId: string) {
    check(await this.db.from("alert_settings").delete().eq("user_id", userId), "alerts.deleteSettings");
    check(await this.db.from("alert_items").delete().eq("user_id", userId), "alerts.deleteItems");
    check(await this.db.from("devices").delete().eq("user_id", userId), "alerts.deleteDevices");
  }
}
