import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * Runs the Supabase repositories against a real Postgres + PostgREST with all migrations applied.
 * Skipped unless NEARPAW_DB_TEST_URL and NEARPAW_DB_TEST_KEY (a service_role key for that PostgREST) are set.
 */
const url = process.env.NEARPAW_DB_TEST_URL;
const key = process.env.NEARPAW_DB_TEST_KEY;
const suite = url && key ? describe : describe.skip;

import { SupabaseAlertRepository } from "../modules/alerts/infrastructure/supabase-alerts.repository";
import { SupabaseAuditRepository } from "../modules/audit/infrastructure/supabase-audit.repository";
import { SupabaseBlockRepository } from "../modules/identity/infrastructure/supabase-block.repository";
import { SupabaseLoginAttempts } from "../modules/identity/infrastructure/supabase-login-attempts";
import { SupabaseUserRepository } from "../modules/identity/infrastructure/supabase-user.repository";
import { SupabaseImpactRepository } from "../modules/impact/infrastructure/supabase-impact.repository";
import { SupabaseAdPlacementRepository, SupabaseConfigRepository, SupabaseRegionRepository } from "../modules/regions/infrastructure/supabase-regions.repository";
import { SupabaseFlagRepository, SupabaseReportRepository, SupabaseUpdateRepository } from "../modules/reports/infrastructure/supabase-reports.repository";
import { SupabaseSupportRepository } from "../modules/support/infrastructure/supabase-support.repository";
import { SupabaseRateLimiter } from "@/backend/shared/infrastructure/rate-limiter";
import type { User } from "../modules/identity/domain/user";
import { createReport, type Report } from "../modules/reports/domain/report";

const uid = () => crypto.randomUUID();
const now = new Date("2026-11-06T10:00:00Z");
const day = 86_400_000;

suite("postgres repositories", () => {
  const db = createClient(url ?? "http://x", key ?? "x", { auth: { persistSession: false } });
  const users = new SupabaseUserRepository(db);
  let rina: User;
  let budi: User;

  const person = async (name: string, email: string): Promise<User> => {
    const u: User = { id: uid(), publicNumber: await users.nextPublicNumber(), role: "user", displayName: name, email, status: "active", warnings: 0, createdAt: now, deletedAt: null, tombstoneId: null };
    await users.save(u);
    return u;
  };

  beforeAll(async () => {
    rina = await person("Rina Wijaya", `rina.${uid().slice(0, 6)}@gmail.com`);
    budi = await person("Budi Santoso", `budi.${uid().slice(0, 6)}@gmail.com`);
  });

  describe("users and blocks", () => {
    it("stores and finds users, with increasing public numbers", async () => {
      expect(await users.findById(rina.id)).toEqual(rina);
      expect((await users.findByPublicNumber(rina.publicNumber))?.id).toBe(rina.id);
      expect(budi.publicNumber).toBeGreaterThan(rina.publicNumber);
      expect(await users.findById("not-a-uuid")).toBeNull();
    });

    it("insertIfAbsent keeps the first row when two requests race", async () => {
      const id = uid();
      const make = async () => ({ ...rina, id, email: "x@y.id", publicNumber: await users.nextPublicNumber() });
      const [a, b] = await Promise.all([make().then((u) => users.insertIfAbsent(u)), make().then((u) => users.insertIfAbsent(u))]);
      expect(a.publicNumber).toBe(b.publicNumber);
    });

    it("updates, searches by status and public number", async () => {
      await users.save({ ...budi, status: "suspended", warnings: 1 });
      expect((await users.findById(budi.id))?.status).toBe("suspended");
      const hit = await users.search({ q: `Community #${budi.publicNumber}`, limit: 10, offset: 0 });
      expect(hit.items.map((u) => u.id)).toContain(budi.id);
      expect((await users.search({ status: "suspended", limit: 100, offset: 0 })).items.every((u) => u.status === "suspended")).toBe(true);
    });

    it("blocks, lists, counts and clears", async () => {
      const blocks = new SupabaseBlockRepository(db);
      await blocks.add(rina.id, budi.id);
      await blocks.add(rina.id, budi.id); // idempotent
      expect(await blocks.listBlocked(rina.id)).toEqual([budi.id]);
      expect(await blocks.countBlockedBy(budi.id)).toBe(1);
      await blocks.removeAllInvolving(budi.id);
      expect(await blocks.listBlocked(rina.id)).toEqual([]);
    });
  });

  describe("alerts", () => {
    it("keeps settings, feed and devices", async () => {
      const alerts = new SupabaseAlertRepository(db);
      expect(await alerts.getSettings(rina.id)).toBeNull();
      await alerts.saveSettings({ userId: rina.id, enabled: true, area: { label: "Kemang", lat: -6.26, lng: 106.81 }, radiusKm: 10, animals: ["cat"] });
      await alerts.saveSettings({ userId: rina.id, enabled: true, area: { label: "Kemang Raya", lat: -6.26, lng: 106.81 }, radiusKm: 10, animals: ["cat", "dog"] });
      expect((await alerts.getSettings(rina.id))?.area?.label).toBe("Kemang Raya");
      expect((await alerts.allSettings()).some((s) => s.userId === rina.id)).toBe(true);

      const item = (n: number) => ({ id: uid(), userId: rina.id, reportRef: `RPT-AAAA0${n}`, title: "Injured cat", urgency: "high", locationLabel: null, distanceKm: 1.2, read: false, delivery: "sent" as const, createdAt: new Date(now.getTime() + n * 1000) });
      await alerts.addItem(item(1));
      await alerts.addItem(item(2));
      expect(await alerts.unreadCount(rina.id)).toBe(2);
      const page = await alerts.listItems(rina.id, { unreadOnly: true, limit: 1, offset: 0 });
      expect(page.total).toBe(2);
      expect(page.items[0].reportRef).toBe("RPT-AAAA02"); // newest first
      await alerts.markRead(rina.id, [page.items[0].id]);
      expect(await alerts.unreadCount(rina.id)).toBe(1);
      await alerts.markRead(rina.id);
      expect(await alerts.unreadCount(rina.id)).toBe(0);
      expect((await alerts.deliveryStats(new Date(now.getTime() - day))).sent).toBeGreaterThanOrEqual(2);

      await alerts.saveDevice(rina.id, "tok-1");
      await alerts.saveDevice(rina.id, "tok-1");
      await alerts.saveDevice(rina.id, "tok-2");
      expect((await alerts.devices(rina.id)).sort()).toEqual(["tok-1", "tok-2"]);
      await alerts.removeDevice(rina.id, "tok-1");
      expect(await alerts.devices(rina.id)).toEqual(["tok-2"]);
      await alerts.deleteUser(rina.id);
      expect(await alerts.getSettings(rina.id)).toBeNull();
    });
  });

  describe("reports, updates and flags", () => {
    const reports = new SupabaseReportRepository(db);
    const updates = new SupabaseUpdateRepository(db);
    const flags = new SupabaseFlagRepository(db);
    const make = (over: Partial<Parameters<typeof createReport>[0]> = {}): Report =>
      createReport({
        reporterId: rina.id, animal: "cat", condition: "injured", urgency: "medium", description: "Gray tabby limping near the roadside.",
        photos: [], location: { lat: -6.2615, lng: 106.8106 }, language: "en", region: null, expiryDays: 7, now, ...over,
      });

    it("round-trips and finds by id and ref", async () => {
      const r = make();
      await reports.add(r);
      expect(await reports.findById(r.id)).toEqual(r);
      expect((await reports.findByRef(r.ref.toLowerCase()))?.id).toBe(r.id);
    });

    it("filters by derived state (expiry), reporter, flags and sorts by urgency", async () => {
      const owner = await person("Dewi", `dewi.${uid().slice(0, 6)}@gmail.com`);
      const low = make({ reporterId: owner.id, urgency: "low" });
      const high = make({ reporterId: owner.id, urgency: "high" });
      const stale = make({ reporterId: owner.id, now: new Date(now.getTime() - 10 * day) }); // expired by `now`
      for (const r of [low, high, stale]) await reports.add(r);

      const live = await reports.search({ now, states: ["live"], reporterId: owner.id, sort: "urgent", limit: 10, offset: 0 });
      expect(live.items.map((r) => r.id)).toEqual([high.id, low.id]);
      const expired = await reports.search({ now, states: ["expired"], reporterId: owner.id, sort: "newest", limit: 10, offset: 0 });
      expect(expired.items.map((r) => r.id)).toEqual([stale.id]);
      const both = await reports.search({ now, states: ["live", "expired"], reporterId: owner.id, sort: "newest", limit: 10, offset: 0 });
      expect(both.total).toBe(3);
      const without = await reports.search({ now, states: ["live"], excludeReporterIds: [owner.id], sort: "newest", limit: 100, offset: 0 });
      expect(without.items.every((r) => r.reporterId !== owner.id)).toBe(true);
      expect(await reports.countByReporterSince(owner.id, new Date(now.getTime() - day))).toBe(2);
      expect((await reports.listByReporter(owner.id)).length).toBe(3);
    });

    it("orders by distance and applies a radius", async () => {
      const owner = await person("Sari", `sari.${uid().slice(0, 6)}@gmail.com`);
      const near = make({ reporterId: owner.id, location: { lat: -6.30, lng: 106.80 } });
      const mid = make({ reporterId: owner.id, location: { lat: -6.40, lng: 106.80 } });
      const far = make({ reporterId: owner.id, location: { lat: -7.80, lng: 110.36 } }); // Yogyakarta
      for (const r of [far, mid, near]) await reports.add(r);
      const center = { lat: -6.30, lng: 106.81 };
      const all = await reports.search({ now, reporterId: owner.id, center, sort: "nearby", limit: 10, offset: 0 });
      expect(all.items.map((r) => r.id)).toEqual([near.id, mid.id, far.id]);
      const within = await reports.search({ now, reporterId: owner.id, center, radiusKm: 30, sort: "nearby", limit: 10, offset: 0 });
      expect(within.items.map((r) => r.id)).toEqual([near.id, mid.id]);
      expect(within.total).toBe(2);
    });

    it("saves moderation changes", async () => {
      const r = make();
      await reports.add(r);
      await reports.save({ ...r, state: "hidden", hiddenBy: "admin", moderationReason: "spam", openFlags: 3 });
      const got = await reports.findById(r.id);
      expect(got).toMatchObject({ state: "hidden", hiddenBy: "admin", openFlags: 3 });
      expect((await reports.search({ now, states: ["hidden"], minOpenFlags: 3, sort: "most_flags", limit: 5, offset: 0 })).items.map((x) => x.id)).toContain(r.id);
    });

    it("stores updates and flags", async () => {
      const r = make();
      await reports.add(r);
      const u = { id: uid(), ref: `UPD-${uid().slice(0, 4).toUpperCase()}`, reportId: r.id, reportRef: r.ref, authorId: budi.id, type: "still_there" as const, note: "Still here", photos: [], state: "live" as const, hiddenBy: null, openFlags: 1, createdAt: now };
      await updates.add(u);
      expect(await updates.findById(u.id)).toEqual(u);
      expect((await updates.listByReport(r.id)).map((x) => x.id)).toEqual([u.id]);
      expect((await updates.listByAuthor(budi.id)).length).toBeGreaterThanOrEqual(1);
      expect((await updates.search({ filter: "flagged", limit: 10, offset: 0 })).items.map((x) => x.id)).toContain(u.id);

      const number = await flags.nextNumber();
      expect(number).toBeGreaterThanOrEqual(201);
      expect(await flags.nextNumber()).toBe(number + 1);
      const f = { id: uid(), number, targetType: "update" as const, targetId: u.id, targetRef: u.ref, flaggerId: rina.id, reason: "spam" as const, details: null, status: "open" as const, outcome: null, notes: null, createdAt: now, resolvedAt: null };
      await flags.add(f);
      expect(await flags.hasFlagged(rina.id, "update", u.id)).toBe(true);
      expect(await flags.hasFlagged(budi.id, "update", u.id)).toBe(false);
      expect((await flags.openFor("update", u.id)).map((x) => x.id)).toEqual([f.id]);
      expect(await flags.countAgainst("update", [u.id])).toBe(1);
      expect((await flags.findByNumber(number))?.id).toBe(f.id);
      await flags.save({ ...f, status: "resolved", outcome: "hide", resolvedAt: now });
      expect((await flags.search({ status: "resolved", limit: 50, offset: 0 })).items.map((x) => x.id)).toContain(f.id);
    });
  });

  describe("regions, config and ad placements", () => {
    it("stores regions and the singleton config", async () => {
      const regions = new SupabaseRegionRepository(db);
      const region = { id: uid(), name: `Test ${uid().slice(0, 6)}`, status: "active" as const, languages: ["en", "id"] as const, defaultExpiryDays: 7, supportContact: "Admin", center: { lat: -6.2, lng: 106.8 }, radiusKm: 20, updatedAt: now };
      await regions.save(region);
      expect(await regions.findById(region.id)).toEqual(region);
      expect((await regions.list()).some((r) => r.id === region.id)).toBe(true);

      const config = new SupabaseConfigRepository(db);
      const before = await config.get();
      await config.save({ ...before, featureFlags: { ...before.featureFlags, listAds: false }, safetyLimits: { ...before.safetyLimits, reportExpiryDays: 9 } });
      const after = await config.get();
      expect(after.featureFlags.listAds).toBe(false);
      expect(after.safetyLimits.reportExpiryDays).toBe(9);

      const placements = new SupabaseAdPlacementRepository(db);
      await placements.set("list_feed_native", "*", true);
      await placements.set("list_feed_native", region.id, true);
      expect((await placements.enabledRegionIds("list_feed_native")).sort()).toEqual(["*", region.id].sort());
      await placements.set("list_feed_native", "*", false);
      await placements.set("list_feed_native", "*", false);
      expect(await placements.enabledRegionIds("list_feed_native")).toEqual([region.id]);
    });
  });

  describe("impact", () => {
    it("stores periods and allocations, and enforces the publish guard", async () => {
      const impact = new SupabaseImpactRepository(db);
      const period = { id: uid(), label: "Q4 2026", summary: "Quarter", published: true, createdAt: now };
      await impact.savePeriod(period);
      expect(await impact.findPeriod(period.id)).toEqual(period);
      const alloc = { id: uid(), periodId: period.id, beneficiary: "Shelter A", category: "shelter" as const, amount: 1250.5, currency: "IDR", transferDate: new Date("2026-10-30T00:00:00Z"), publicNote: "Food", evidence: ["public/evidence/a.webp"], redactionChecked: true, transferConfirmed: true, status: "published" as const, publishedAt: now };
      await impact.saveAllocation(alloc);
      expect(await impact.findAllocation(alloc.id)).toEqual(alloc);
      expect((await impact.listAllocations(period.id)).length).toBe(1);
      await expect(impact.saveAllocation({ ...alloc, id: uid(), evidence: [], status: "published" })).rejects.toThrow(/allocation_publishable/);
    });
  });

  describe("support and audit", () => {
    it("stores messages with replies and notes, and privacy requests", async () => {
      const support = new SupabaseSupportRepository(db);
      const m = { id: uid(), ref: `SUP-${uid().slice(0, 6).toUpperCase()}`, topic: "bug" as const, email: "rina@example.com", language: "id" as const, message: "The map does not load for me", reportRef: null, status: "new" as const, assignee: null, escalated: false, replies: [], notes: [], createdAt: now, resolvedAt: null };
      await support.addMessage(m);
      const replied = { ...m, status: "assigned" as const, assignee: "Admin", replies: [{ body: "Looking into it", at: now, delivered: false }], notes: [{ body: "Seen on iOS 27", at: now }] };
      await support.saveMessage(replied);
      expect(await support.findMessage(m.id)).toEqual(replied);
      expect(await support.countMessages("assigned")).toBeGreaterThanOrEqual(1);
      expect((await support.searchMessages({ status: "assigned", topic: "bug", language: "id", limit: 10, offset: 0 })).items.map((x) => x.id)).toContain(m.id);

      const p = { id: uid(), ref: `PRV-${uid().slice(0, 6).toUpperCase()}`, type: "access" as const, email: "rina@example.com", accountIdentifier: null, details: "Send me my data", status: "received" as const, emailMatchesAccount: false, extraProofReceived: false, notes: [], createdAt: now, dueAt: new Date(now.getTime() + 30 * day), completedAt: null };
      await support.addPrivacy(p);
      expect((await support.openPrivacy()).map((x) => x.id)).toContain(p.id);
      await support.savePrivacy({ ...p, status: "completed", emailMatchesAccount: true, completedAt: now });
      expect((await support.findPrivacy(p.id))?.status).toBe("completed");
      expect((await support.searchPrivacy({ status: "completed", limit: 10, offset: 0 })).items.map((x) => x.id)).toContain(p.id);
    });

    it("appends to the audit log, which can never be edited", async () => {
      const audit = new SupabaseAuditRepository(db);
      const rec = { id: uid(), at: now, actor: { kind: "admin" as const, id: "admin-1" }, action: "user.ban", target: "Community #4821", reason: "spam", metadata: { count: 2, hard: true } };
      await audit.append(rec);
      expect((await audit.search({ actor: "admin", action: "user.", target: "community #48", limit: 10, offset: 0 })).items).toContainEqual(rec);
      expect((await audit.recent(5)).length).toBeGreaterThan(0);
      const { error } = await db.from("audit_log").update({ reason: "tampered" }).eq("id", rec.id);
      expect(error?.message).toMatch(/append-only/);
    });
  });

  describe("rate limits and lockouts", () => {
    it("counts attempts atomically per key and window", async () => {
      const limiter = new SupabaseRateLimiter(db);
      const k = `test:${uid()}`;
      const results = await Promise.all(Array.from({ length: 8 }, () => limiter.allow(k, 5, 3_600_000)));
      expect(results.filter(Boolean)).toHaveLength(5);
      expect(await limiter.allow(`test:${uid()}`, 1, 3_600_000)).toBe(true);
    });

    it("persists login lockouts", async () => {
      const attempts = new SupabaseLoginAttempts(db);
      const k = `user:${uid()}@x.id`;
      expect(await attempts.get(k)).toBeUndefined();
      await attempts.set(k, { failures: 0, lockedUntil: now.getTime() + 900_000 });
      expect(await attempts.get(k)).toEqual({ failures: 0, lockedUntil: now.getTime() + 900_000 });
      await attempts.clear(k);
      expect(await attempts.get(k)).toBeUndefined();
    });
  });
});
