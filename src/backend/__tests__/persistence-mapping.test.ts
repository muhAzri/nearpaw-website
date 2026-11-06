import { describe, expect, it, vi } from "vitest";

// The repositories import the "server-only" admin helper; outside Next it throws on purpose.
vi.mock("server-only", () => ({}));
import { itemFromRow, itemToRow, settingsFromRow, settingsToRow } from "../modules/alerts/infrastructure/supabase-alerts.repository";
import { userFromRow, userToRow } from "../modules/identity/infrastructure/supabase-user.repository";
import { InMemoryUserRepository } from "./support/in-memory-identity";
import { ProfileProvisioner } from "../modules/identity/application/profile-provisioner";
import type { AlertItem, AlertSettings } from "../modules/alerts/domain/alert";
import type { User } from "../modules/identity/domain/user";

const user: User = {
  id: "11111111-1111-4111-8111-111111111111",
  publicNumber: 4821,
  role: "user",
  displayName: "Rina",
  email: "rina.wijaya91@gmail.com",
  status: "restricted",
  warnings: 2,
  createdAt: new Date("2026-11-01T00:00:00Z"),
  deletedAt: null,
  tombstoneId: null,
};

describe("row mapping", () => {
  it("round-trips a user", () => {
    expect(userFromRow(userToRow(user))).toEqual(user);
    const gone: User = { ...user, status: "deleted", email: null, deletedAt: new Date("2026-11-05T00:00:00Z"), tombstoneId: "d-1111" };
    expect(userFromRow(userToRow(gone))).toEqual(gone);
  });

  it("round-trips alert settings, with and without an area", () => {
    const set: AlertSettings = { userId: user.id, enabled: true, area: { label: "Kemang", lat: -6.26, lng: 106.81 }, radiusKm: 10, animals: ["cat", "dog"] };
    expect(settingsFromRow(settingsToRow(set))).toEqual(set);
    const none: AlertSettings = { userId: user.id, enabled: false, area: null, radiusKm: 5, animals: [] };
    expect(settingsFromRow(settingsToRow(none))).toEqual(none);
    expect(settingsToRow(none)).toMatchObject({ area_label: null, area_lat: null, area_lng: null });
  });

  it("round-trips an alert item", () => {
    const item: AlertItem = {
      id: "22222222-2222-4222-8222-222222222222", userId: user.id, reportRef: "NP-4821", title: "Injured cat", urgency: "high",
      locationLabel: null, distanceKm: 1.4, read: false, delivery: "sent", createdAt: new Date("2026-11-06T10:00:00Z"),
    };
    expect(itemFromRow(itemToRow(item))).toEqual(item);
  });
});

describe("profile provisioning under concurrency", () => {
  it("two first requests for one account end up with the same profile", async () => {
    const users = new InMemoryUserRepository();
    const profiles = new ProfileProvisioner(users, { now: () => new Date("2026-11-06T10:00:00Z") }, undefined);
    const [a, b] = await Promise.all([
      profiles.ensure({ id: user.id, email: "rina.wijaya91@gmail.com" }),
      profiles.ensure({ id: user.id, email: "rina.wijaya91@gmail.com" }),
    ]);
    expect(b.publicNumber).toBe(a.publicNumber);
    expect((await users.findById(user.id))?.publicNumber).toBe(a.publicNumber);
  });
});
