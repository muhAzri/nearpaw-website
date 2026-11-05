import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatMinutes, formatMoney, formatRelativeTime, humanize } from "./format";

const NOW = new Date("2026-11-05T12:00:00Z").getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("formatRelativeTime", () => {
  it("steps through minutes, hours, yesterday and days", () => {
    expect(formatRelativeTime(ago(20_000), NOW)).toBe("just now");
    expect(formatRelativeTime(ago(12 * 60_000), NOW)).toBe("12 min ago");
    expect(formatRelativeTime(ago(3 * 3_600_000), NOW)).toBe("3 h ago");
    expect(formatRelativeTime(ago(30 * 3_600_000), NOW)).toBe("Yesterday");
    expect(formatRelativeTime(ago(4 * 86_400_000), NOW)).toBe("4 days ago");
  });

  it("falls back to a date for old items and never goes negative", () => {
    expect(formatRelativeTime(ago(40 * 86_400_000), NOW)).toBe("26 Sep 2026");
    expect(formatRelativeTime(new Date(NOW + 5 * 60_000).toISOString(), NOW)).toBe("just now");
  });
});

describe("formatMinutes", () => {
  it("formats minutes, hours and days", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(200)).toBe("3 h 20 min");
    expect(formatMinutes(120)).toBe("2 h");
    expect(formatMinutes(3 * 24 * 60)).toBe("3 days");
  });
});

describe("formatDate / formatDateTime", () => {
  it("formats a UTC date", () => {
    expect(formatDate("2026-09-12T23:30:00Z")).toBe("12 Sep 2026");
  });

  it("says Today / Yesterday relative to now", () => {
    expect(formatDateTime(new Date(NOW).toISOString(), NOW)).toMatch(/^Today \d{2}:\d{2}$/);
    expect(formatDateTime(new Date(NOW - 86_400_000).toISOString(), NOW)).toMatch(/^Yesterday \d{2}:\d{2}$/);
  });
});

describe("formatMoney / humanize", () => {
  it("keeps the currency code and never merges currencies", () => {
    expect(formatMoney(1500000, "IDR")).toBe("IDR 1,500,000");
    expect(formatMoney(250.5, "USD")).toBe("USD 250.50");
  });

  it("humanizes enum values", () => {
    expect(humanize("suspected_abuse")).toBe("Suspected abuse");
    expect(humanize("cat")).toBe("Cat");
  });
});
