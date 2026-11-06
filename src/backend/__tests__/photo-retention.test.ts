import { describe, expect, it } from "vitest";
import { createUpdate } from "../modules/reports/domain/community-update";
import { createReport, type Report } from "../modules/reports/domain/report";
import { PhotoRetention } from "../modules/reports/application/photo-retention";
import { InMemoryReportRepository, InMemoryUpdateRepository } from "./support/in-memory-reports";

const DAY = 86_400_000;
const NOW = new Date("2026-11-20T03:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);

const key = (id: string) => `public/report/user-1/${id}.webp`;

function report(over: Partial<Report> & { photos: string[]; created: Date; expiryDays?: number }): Report {
  const { created, expiryDays = 7, photos, ...rest } = over;
  return { ...createReport({ reporterId: "user-1", animal: "cat", condition: "injured", urgency: "high", description: "Cat near the bus stop", photos, location: { lat: -6.26, lng: 106.81 }, language: "en", region: null, expiryDays, now: created }), ...rest };
}

function setup() {
  const reports = new InMemoryReportRepository();
  const updates = new InMemoryUpdateRepository();
  const deleted: string[] = [];
  const eraser = { deleteObjects: async (keys: readonly string[]) => void deleted.push(...keys) };
  return { reports, updates, deleted, eraser, retention: new PhotoRetention(reports, updates, eraser) };
}

describe("PhotoRetention", () => {
  it("deletes photos and thumbnails of reports that expired before the grace period, and clears the keys", async () => {
    const { reports, retention, deleted } = setup();
    const stale = report({ photos: [key("a"), key("b")], created: daysAgo(12) }); // expired 5 days ago
    await reports.add(stale);

    const result = await retention.run(NOW);

    expect(result).toEqual({ reports: 1, updates: 0, files: 4 });
    expect(deleted.sort()).toEqual([key("a"), key("a").replace(".webp", "_t.webp"), key("b"), key("b").replace(".webp", "_t.webp")].sort());
    expect((await reports.findById(stale.id))?.photos).toEqual([]);
  });

  it("keeps photos of live reports and of reports still inside the grace period", async () => {
    const { reports, retention, deleted } = setup();
    const live = report({ photos: [key("live")], created: daysAgo(2) });
    const justExpired = report({ photos: [key("recent")], created: daysAgo(8) }); // expired yesterday
    await reports.add(live);
    await reports.add(justExpired);

    expect(await retention.run(NOW)).toEqual({ reports: 0, updates: 0, files: 0 });
    expect(deleted).toEqual([]);
    expect((await reports.findById(live.id))?.photos).toEqual([key("live")]);
    expect((await reports.findById(justExpired.id))?.photos).toEqual([key("recent")]);
  });

  it("removes photos of removed reports right away, and of closed ones after the grace period", async () => {
    const { reports, retention } = setup();
    const removed = report({ photos: [key("gone")], created: daysAgo(1), state: "removed" });
    const closedLongAgo = report({ photos: [key("old")], created: daysAgo(6), state: "closed", closedAt: daysAgo(4) });
    const closedToday = report({ photos: [key("new")], created: daysAgo(2), state: "closed", closedAt: daysAgo(1) });
    for (const r of [removed, closedLongAgo, closedToday]) await reports.add(r);

    const result = await retention.run(NOW);

    expect(result.reports).toBe(2);
    expect((await reports.findById(removed.id))?.photos).toEqual([]);
    expect((await reports.findById(closedLongAgo.id))?.photos).toEqual([]);
    expect((await reports.findById(closedToday.id))?.photos).toEqual([key("new")]);
  });

  it("also deletes the photos of community updates on those reports", async () => {
    const { reports, updates, retention, deleted } = setup();
    const stale = report({ photos: [key("r")], created: daysAgo(12) });
    await reports.add(stale);
    const live = report({ photos: [], created: daysAgo(20) });
    const update = createUpdate({ ...live, state: "live", expiresAt: new Date(NOW.getTime() + DAY), id: stale.id, ref: stale.ref }, { authorId: "user-2", type: "still_there", photos: ["public/update/user-2/u1.webp"], now: daysAgo(11) });
    await updates.add(update);

    const result = await retention.run(NOW);

    expect(result.updates).toBe(1);
    expect(deleted).toContain("public/update/user-2/u1.webp");
    expect(deleted).toContain("public/update/user-2/u1_t.webp");
    expect((await updates.findById(update.id))?.photos).toEqual([]);
  });

  it("clears nothing when the files could not be deleted, so the next run retries", async () => {
    const { reports, updates } = setup();
    const stale = report({ photos: [key("a")], created: daysAgo(12) });
    await reports.add(stale);
    const failing = new PhotoRetention(reports, updates, { deleteObjects: async () => { throw new Error("bucket unreachable"); } });

    await expect(failing.run(NOW)).rejects.toThrow("bucket unreachable");
    expect((await reports.findById(stale.id))?.photos).toEqual([key("a")]);
  });

  it("is idempotent: a second run finds nothing to do", async () => {
    const { reports, retention } = setup();
    await reports.add(report({ photos: [key("a")], created: daysAgo(12) }));
    await retention.run(NOW);
    expect(await retention.run(NOW)).toEqual({ reports: 0, updates: 0, files: 0 });
  });
});
