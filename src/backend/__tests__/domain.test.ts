import { describe, expect, it } from "vitest";
import { totpMatches } from "../modules/identity/infrastructure/env-admin.directory";
import { afterFailure, isLocked } from "../modules/identity/domain/login-policy";
import { createReport, effectiveState, hide, restore, reportTitle } from "../modules/reports/domain/report";
import { shouldAutoHide } from "../modules/reports/domain/flag";
import { publish, totalsByCurrency, verify, type Allocation } from "../modules/impact/domain/impact";
import { matchDistance } from "../modules/alerts/domain/alert";
import { containsContactInfo } from "@/backend/shared/domain/text";
import { distanceKm } from "@/backend/shared/domain/geo";

const now = new Date("2026-11-05T10:00:00Z");
const base = {
  reporterId: "u1",
  animal: "cat" as const,
  condition: "injured" as const,
  urgency: "high" as const,
  description: "Cat seen near the roadside; limping.",
  photos: [],
  location: { lat: -6.26, lng: 106.81 },
  language: "en" as const,
  region: null,
  expiryDays: 7,
  now,
};

describe("report domain", () => {
  it("creates a live report that expires after the region default", () => {
    const r = createReport(base);
    expect(r.ref).toMatch(/^RPT-[A-Z0-9]{6}$/);
    expect(effectiveState(r, now)).toBe("live");
    expect(effectiveState(r, new Date(now.getTime() + 8 * 86_400_000))).toBe("expired");
    expect(reportTitle(r)).toBe("Injured cat");
  });

  it("needs no region: area comes from the device, or from a matching region", () => {
    expect(createReport({ ...base, areaName: "Paris" }).regionId).toBeNull();
    expect(createReport({ ...base, areaName: "Paris" }).areaName).toBe("Paris");
    const inRegion = createReport({ ...base, region: { id: "r1", name: "South Jakarta" } });
    expect(inRegion.regionId).toBe("r1");
    expect(inRegion.areaName).toBe("South Jakarta");
  });

  it("rejects phone numbers and emails in public text", () => {
    expect(() => createReport({ ...base, description: "call me 0812 3456 7890" })).toThrow();
    expect(() => createReport({ ...base, description: "mail a@b.co please" })).toThrow();
    expect(containsContactInfo("about 2 km away, 12 m from the road")).toBe(false);
  });

  it("hides and restores", () => {
    const r = createReport(base);
    const hidden = hide(r, "auto", "3 flags");
    expect(hidden.state).toBe("hidden");
    expect(restore(hidden).state).toBe("live");
  });

  it("auto-hides at the threshold", () => {
    expect(shouldAutoHide(2, 3)).toBe(false);
    expect(shouldAutoHide(3, 3)).toBe(true);
  });
});

describe("admin auth", () => {
  it("matches the RFC 6238 test vector", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(totpMatches(secret, "287082", new Date(59_000))).toBe(true);
    expect(totpMatches(secret, "000000", new Date(59_000))).toBe(false);
  });

  it("locks after 5 failures for 15 minutes", () => {
    let state = undefined as ReturnType<typeof afterFailure> | undefined;
    for (let i = 0; i < 5; i++) state = afterFailure(state, 0);
    expect(isLocked(state, 1000)).toBe(true);
    expect(isLocked(state, 16 * 60_000)).toBe(false);
  });
});

describe("impact rules", () => {
  const draft: Allocation = {
    id: "a1",
    periodId: "p1",
    beneficiary: "Shelter A",
    category: "shelter",
    amount: 100.5,
    currency: "IDR",
    transferDate: now,
    publicNote: "",
    evidence: [],
    redactionChecked: false,
    transferConfirmed: false,
    status: "draft",
    publishedAt: null,
  };
  const period = { id: "p1", label: "Q4", summary: "", published: true, createdAt: now };

  it("needs confirmation and evidence to verify, and verification + redaction to publish", () => {
    expect(() => verify(draft)).toThrow();
    const ready = { ...draft, transferConfirmed: true, evidence: ["evidence/r.pdf"] };
    expect(() => publish(ready, period, now)).toThrow();
    const verified = verify(ready);
    expect(() => publish(verified, period, now)).toThrow();
    expect(publish({ ...verified, redactionChecked: true }, period, now).status).toBe("published");
  });

  it("never adds currencies together", () => {
    const totals = totalsByCurrency([draft, { ...draft, amount: 0.1 }, { ...draft, currency: "USD", amount: 5 }]);
    expect(totals).toEqual([
      { currency: "IDR", amount: 100.6 },
      { currency: "USD", amount: 5 },
    ]);
  });
});

describe("alerts matching", () => {
  const settings = { userId: "u2", enabled: true, area: { label: "Cilandak", lat: -6.26, lng: 106.81 }, radiusKm: 5 as const, animals: ["cat"] };
  const report = { ref: "RPT-AAAAAA", title: "x", animal: "cat", urgency: "low", location: { lat: -6.27, lng: 106.81 }, locationLabel: null, reporterId: "u1" };

  it("matches inside the radius and animal filter, but not the reporter", () => {
    expect(matchDistance(settings, report)).toBeCloseTo(distanceKm(settings.area, report.location));
    expect(matchDistance({ ...settings, animals: ["dog"] }, report)).toBeNull();
    expect(matchDistance({ ...settings, radiusKm: 2 }, { ...report, location: { lat: -6.4, lng: 106.81 } })).toBeNull();
    expect(matchDistance({ ...settings, userId: "u1" }, report)).toBeNull();
  });
});
