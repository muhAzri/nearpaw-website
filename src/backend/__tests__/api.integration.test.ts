import { beforeAll, describe, expect, it, vi } from "vitest";

// `connection()` only works inside a Next.js request; the handlers are otherwise plain.
vi.mock("next/server", () => ({ connection: async () => {} }));

const ADMIN = { email: "admin@nearpaw.test", password: "correct-horse-battery-9" };
const PASSWORD = "paws4life26";

// Test helper: responses are asserted structurally, so untyped data is intentional.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = { data?: any; error?: { code: string; message: string } };

let call: (method: string, path: string, opts?: { token?: string; body?: unknown; query?: string }) => Promise<{ status: number; json: Json }>;

let fake: import("./support/fake-auth-provider").FakeAuthProvider;
let profiles: import("./support/in-memory-identity").InMemoryUserRepository;

beforeAll(async () => {
  // The API keeps its data in Supabase; these tests swap in in-memory doubles for the storage and the auth provider.
  const { inMemoryBackend } = await import("./support/in-memory-storage");
  const { useBackendOverrides } = await import("../composition");
  const doubles = inMemoryBackend();
  fake = doubles.auth;
  profiles = doubles.overrides.storage!.users as typeof profiles;
  useBackendOverrides(doubles.overrides);
  process.env.ADMIN_EMAIL = ADMIN.email;
  process.env.S3_PUBLIC_BASE_URL = "https://files.example.test/";

  // Route modules are thin; drive the same handlers through the real route files.
  const load = async (p: string) => (await import(/* @vite-ignore */ `@/app/api/v1/${p}/route`)) as Record<string, (req: Request, ctx?: unknown) => Promise<Response>>;
  call = async (method, path, opts = {}) => {
    const segments = path.split("/").filter(Boolean);
    // Find the route file whose dynamic segments match.
    const { resolveRoute } = await import("./route-resolver");
    const { file, params } = resolveRoute(segments);
    const mod = await load(file);
    const req = new Request(`http://localhost/api/v1/${path}${opts.query ?? ""}`, {
      method,
      headers: {
        ...(opts.token && { authorization: `Bearer ${opts.token}` }),
        ...(opts.body !== undefined && { "content-type": "application/json" }),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const res = await mod[method](req, { params: Promise.resolve(params) });
    return { status: res.status, json: res.status === 204 ? {} : ((await res.json()) as Json) };
  };
});

const emailOf = (name: string) => `${name}@nearpaw.test`;
/** Stands in for opening the confirmation link in the inbox. */
const confirmEmail = async (name: string) => fake.confirm(emailOf(name));
/** Register, confirm the email and sign in, the way a person does in the app. */
const signIn = async (name: string) => {
  expect((await call("POST", "auth/register", { body: { email: emailOf(name), password: PASSWORD, acceptedTerms: true } })).status).toBe(201);
  await confirmEmail(name);
  return (await call("POST", "auth/sign-in", { body: { email: emailOf(name), password: PASSWORD } })).json.data.token as string;
};
/** The admin has a normal Supabase account; ADMIN_EMAIL gives it the admin role on first sign-in. */
const adminLogin = async (password = ADMIN.password) => {
  await call("POST", "auth/register", { body: { email: ADMIN.email, password: ADMIN.password, acceptedTerms: true } });
  await confirmEmail("admin");
  return call("POST", "admin/auth/login", { body: { email: ADMIN.email, password } });
};
const adminToken = async () => (await adminLogin()).json.data.token as string;
const report = (over: Record<string, unknown> = {}) => ({
  animal: "cat",
  condition: "injured",
  urgency: "high",
  description: "Gray tabby limping near the roadside, no collar.",
  location: { lat: -6.2615, lng: 106.8106 },
  locationLabel: "Jl. Kemang Raya, Cilandak",
  consent: true,
  ...over,
});

describe("nearpaw backend", () => {
  it("keeps people signed in with rotating refresh tokens and ends the session on sign-out", async () => {
    const body = { email: emailOf("indah.permata95"), password: PASSWORD, acceptedTerms: true };
    expect((await call("POST", "auth/register", { body })).status).toBe(201);
    await confirmEmail("indah.permata95");
    const session = (await call("POST", "auth/sign-in", { body: { email: body.email, password: PASSWORD } })).json.data;
    expect(session.expiresInSeconds).toBe(3600);
    expect(session.refreshToken).toBeTruthy();
    expect(session.token.split(".")).toHaveLength(3); // a standard JWT
    expect(session.refreshExpiresInSeconds).toBe(90 * 24 * 3600);

    const renewed = await call("POST", "auth/refresh", { body: { refreshToken: session.refreshToken } });
    expect(renewed.status).toBe(200);
    expect(renewed.json.data.refreshToken).not.toBe(session.refreshToken);
    expect(renewed.json.data.user.email).toBe(body.email);
    expect((await call("GET", "me", { token: renewed.json.data.token })).status).toBe(200);

    // a garbled or unknown token is a plain 401 with the friendly line
    const bad = await call("POST", "auth/refresh", { body: { refreshToken: "z".repeat(43) } });
    expect(bad.status).toBe(401);
    expect(bad.json.error?.message).toBe("Your session has ended. Please sign in again.");
    expect((await call("POST", "auth/refresh", { body: { refreshToken: "short" } })).status).toBe(422);

    // signing out is always 204 and kills the refresh token
    expect((await call("POST", "auth/sign-out", { token: renewed.json.data.token })).status).toBe(204);
    expect((await call("POST", "auth/refresh", { body: { refreshToken: renewed.json.data.refreshToken } })).status).toBe(401);
    expect((await call("POST", "auth/sign-out")).status).toBe(204);
    expect((await call("POST", "auth/sign-out", { token: "not-a-token" })).status).toBe(204);
  });

  it("refuses refresh tokens once an account is deleted", async () => {
    const body = { email: emailOf("galih.pratama90"), password: PASSWORD, acceptedTerms: true };
    await call("POST", "auth/register", { body });
    await confirmEmail("galih.pratama90");
    const session = (await call("POST", "auth/sign-in", { body: { email: body.email, password: PASSWORD } })).json.data;
    expect((await call("DELETE", "me", { token: session.token, body: { reports: "keep_anonymous", confirm: true } })).status).toBe(204);
    expect((await call("POST", "auth/refresh", { body: { refreshToken: session.refreshToken } })).status).toBe(401);
  });

  it("does not sign anyone out when the profile store is reset (restart, another instance)", async () => {
    const body = { email: emailOf("wulan.sari92"), password: PASSWORD, acceptedTerms: true };
    await call("POST", "auth/register", { body });
    await confirmEmail("wulan.sari92");
    const session = (await call("POST", "auth/sign-in", { body: { email: body.email, password: PASSWORD } })).json.data;
    profiles.clear();
    expect((await call("GET", "me", { token: session.token })).status).toBe(200);
    expect((await call("POST", "auth/refresh", { body: { refreshToken: session.refreshToken } })).status).toBe(200);
  });

  it("hands out photo uploads only to signed-in users and answers 503 until storage is configured", async () => {
    const files = [{ contentType: "image/webp", sizeBytes: 150_000 }];
    expect((await call("POST", "media/uploads", { body: { purpose: "report", files } })).status).toBe(401);
    const token = await signIn("rina.wijaya91");
    const res = await call("POST", "media/uploads", { token, body: { purpose: "report", files } });
    expect(res.status).toBe(503);
    expect(res.json.error?.code).toBe("SERVICE_UNAVAILABLE");
    const bad = await call("POST", "media/uploads", { token, body: { purpose: "report", files: [{ contentType: "image/png", sizeBytes: 10 }] } });
    expect(bad.status).toBe(422);
  });

  it("only lets people attach photos they uploaded", async () => {
    const token = await signIn("dewi.lestari88");
    const foreign = await call("POST", "reports", { token, body: report({ photos: ["public/report/someone-else/abc123.webp"] }) });
    expect(foreign.status).toBe(422);
    expect(foreign.json.error?.message).toMatch(/uploaded by you/);
    const me = (await call("GET", "me", { token })).json.data.id as string;
    const mine = await call("POST", "reports", { token, body: report({ photos: [`public/report/${me}/abc123.webp`] }) });
    expect(mine.status).toBe(201);
  });

  it("serves the small thumbnail in lists and the full photo in detail", async () => {
    const token = await signIn("sari.utami77");
    const me = (await call("GET", "me", { token })).json.data.id as string;
    const full = `public/report/${me}/abc123.webp`;
    const created = await call("POST", "reports", { token, body: report({ photos: [full] }) });
    expect(created.status).toBe(201);
    const ref = created.json.data.ref as string;
    const list = await call("GET", "reports", { query: "?lat=-6.2615&lng=106.8106" });
    const row = (list.json.data.items as { ref: string; thumbnail: string }[]).find((r) => r.ref === ref);
    expect(row?.thumbnail).toBe(`https://files.example.test/public/report/${me}/abc123_t.webp`);
    expect((await call("GET", `reports/${ref}`)).json.data.photos).toEqual([`https://files.example.test/${full}`]);
    // asking for upload URLs with a thumbnail is part of the public contract
    const bad = await call("POST", "media/uploads", { token, body: { purpose: "report", files: [{ contentType: "image/webp", sizeBytes: 1000, thumbnailSizeBytes: 999_999 }] } });
    expect(bad.status).toBe(422);
  });

  it("exposes the media base URL in the launch config", async () => {
    // trailing slash is trimmed so the app can append keys safely
    expect((await call("GET", "config")).json.data.mediaBaseUrl).toBe("https://files.example.test");
  });

  it("reports health and public config", async () => {
    const cfg = await call("GET", "config");
    expect(cfg.status).toBe(200);
    expect(cfg.json.data.regions).toEqual([]); // no regions needed
  });

  it("registers, requires a confirmed email, signs in and recovers a password", async () => {
    const body = { email: emailOf("maya.putri"), password: PASSWORD, acceptedTerms: true };
    const reg = await call("POST", "auth/register", { body });
    expect(reg.status).toBe(201);
    expect(reg.json.data).toEqual({ status: "verification_required", email: "m***@nearpaw.test" });

    // the same address can't register twice
    const dup = await call("POST", "auth/register", { body });
    expect(dup.status).toBe(409);
    expect(dup.json.error?.message).toBe("This email is already registered. Sign in instead.");

    // signing in before the link is opened points the app at the verify screen
    const early = await call("POST", "auth/sign-in", { body: { email: body.email, password: PASSWORD } });
    expect(early.status).toBe(403);
    expect(early.json.error?.code).toBe("EMAIL_NOT_VERIFIED");

    await confirmEmail("maya.putri");
    const wrong = await call("POST", "auth/sign-in", { body: { email: body.email, password: "wrong-pass-1" } });
    expect(wrong.status).toBe(401);
    expect(wrong.json.error?.message).toBe("Wrong email or password. Try again.");

    const session = await call("POST", "auth/sign-in", { body: { email: body.email.toUpperCase(), password: PASSWORD } });
    expect(session.status).toBe(200);
    expect(session.json.data.user).toMatchObject({ signInMethod: "email", email: body.email, status: "active" });
    expect((await call("GET", "me", { token: session.json.data.token })).json.data.email).toBe(body.email);

    // recovery never reveals whether the account exists
    const known = await call("POST", "auth/forgot-password", { body: { email: body.email } });
    const unknown = await call("POST", "auth/forgot-password", { body: { email: emailOf("nobody.here") } });
    expect([known.status, unknown.status]).toEqual([200, 200]);
    expect(known.json).toEqual(unknown.json);
    expect((await call("POST", "auth/resend-verification", { body: { email: emailOf("nobody.here") } })).status).toBe(200);
  });

  it("only lets accounts with the admin role into the console", async () => {
    const user = await signIn("budi.santoso");
    const denied = await call("POST", "admin/auth/login", { body: { email: emailOf("budi.santoso"), password: PASSWORD } });
    expect(denied.status).toBe(403);
    expect((await call("GET", "admin/dashboard", { token: user })).status).toBe(403);

    const admin = await adminToken();
    expect((await call("GET", "admin/dashboard", { token: admin })).status).toBe(200);
  });

  it("rejects weak passwords and a missing terms checkbox, and locks after repeated wrong passwords", async () => {
    const email = emailOf("rina.wijaya");
    const reg = (over: Record<string, unknown>) => call("POST", "auth/register", { body: { email, password: PASSWORD, acceptedTerms: true, ...over } });
    expect((await reg({ password: "short1" })).status).toBe(422);
    expect((await reg({ password: "onlyletters" })).status).toBe(422);
    expect((await reg({ password: "password123" })).status).toBe(422);
    expect((await reg({ acceptedTerms: false })).status).toBe(422);

    await signIn("rina.wijaya");
    for (let i = 0; i < 5; i++) {
      expect((await call("POST", "auth/sign-in", { body: { email, password: "nope-nope-9" } })).status).toBe(401);
    }
    expect((await call("POST", "auth/sign-in", { body: { email, password: PASSWORD } })).status).toBe(429);
  });

  it("requires sign-in, works worldwide and rejects contact info", async () => {
    expect((await call("POST", "reports", { body: report() })).status).toBe(401);
    const t = await signIn("alice");
    // anywhere in the world works without any region configured
    expect((await call("POST", "reports", { token: t, body: report({ location: { lat: 48.8566, lng: 2.3522 }, areaName: "Paris" }) })).status).toBe(201);
    expect((await call("POST", "reports", { token: t, body: report({ description: "call 0812-3456-7890 now" }) })).status).toBe(422);
    expect((await call("POST", "reports", { token: t, body: report({ consent: false }) })).status).toBe(422);
  });

  it("publishes a report, lists it nearby, auto-hides on flags and lets an admin keep it", async () => {
    const author = await signIn("bob");
    const created = await call("POST", "reports", { token: author, body: report() });
    expect(created.status).toBe(201);
    const ref = created.json.data.ref as string;

    const near = await call("GET", "reports", { query: "?lat=-6.26&lng=106.81&radiusKm=5" });
    expect(near.json.data.items.map((r: { ref: string }) => r.ref)).toContain(ref);
    expect(near.json.data.items[0]).not.toHaveProperty("reporterId");

    // can't flag your own report; three different people hide it
    expect((await call("POST", "flags", { token: author, body: { targetType: "report", targetId: ref, reason: "spam" } })).status).toBe(422);
    for (const who of ["c1", "c2", "c3"]) {
      const t = await signIn(who);
      expect((await call("POST", "flags", { token: t, body: { targetType: "report", targetId: ref, reason: "inaccurate" } })).status).toBe(201);
      if (who === "c1") expect((await call("POST", "flags", { token: t, body: { targetType: "report", targetId: ref, reason: "spam" } })).status).toBe(409);
    }
    expect((await call("GET", `reports/${ref}`)).status).toBe(404);
    expect((await call("GET", `me/reports/${ref}`, { token: author })).json.data.moderation.hidden).toBe(true);

    // admin console
    expect((await adminLogin("wrong-password-xx")).status).toBe(401);
    const login = await adminLogin();
    expect(login.status).toBe(200);
    const admin = login.json.data.token as string;

    expect((await call("GET", "admin/reports", { token: author })).status).toBe(403);
    const review = await call("GET", `admin/reports/${ref}`, { token: admin });
    expect(review.json.data.state).toBe("hidden");
    expect(review.json.data.hiddenBy).toBe("auto");

    const flags = await call("GET", "admin/flags", { token: admin });
    expect(flags.json.data.total).toBe(3);

    const keep = await call("POST", `admin/reports/${ref}/decision`, { token: admin, body: { decision: "keep", reason: "Looks genuine" } });
    expect(keep.json.data.state).toBe("live");
    expect((await call("GET", "admin/flags", { token: admin })).json.data.total).toBe(0);
    expect((await call("GET", `reports/${ref}`)).status).toBe(200);

    const audit = await call("GET", "admin/audit", { token: admin });
    const actions = audit.json.data.items.map((a: { action: string }) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["report.auto_hide", "report.keep", "admin.login"]));

    const dash = await call("GET", "admin/dashboard", { token: admin });
    expect(dash.json.data.liveReports).toBeGreaterThanOrEqual(1);
  });

  it("rate limits reports per user", async () => {
    const t = await signIn("dana");
    for (let i = 0; i < 3; i++) expect((await call("POST", "reports", { token: t, body: report() })).status).toBe(201);
    expect((await call("POST", "reports", { token: t, body: report() })).status).toBe(429);
  });

  it("lets users add updates, block reporters and delete their account", async () => {
    const author = await signIn("erin");
    const ref = (await call("POST", "reports", { token: author, body: report() })).json.data.ref as string;
    const other = await signIn("frank");

    const upd = await call("POST", `reports/${ref}/updates`, { token: other, body: { type: "still_there", note: "Still near the bus stop." } });
    expect(upd.status).toBe(201);
    expect((await call("GET", `reports/${ref}`)).json.data.updates).toHaveLength(1);

    expect((await call("POST", `reports/${ref}/block-reporter`, { token: other })).status).toBe(204);
    expect((await call("GET", `reports/${ref}`, { token: other })).status).toBe(404);
    const blocked = (await call("GET", "me/blocks", { token: other })).json.data;
    expect(blocked).toHaveLength(1);
    expect((await call("DELETE", `me/blocks/${blocked[0].handle}`, { token: other })).status).toBe(204);

    expect((await call("DELETE", "me", { token: author, body: { reports: "delete", confirm: true } })).status).toBe(204);
    expect((await call("GET", `reports/${ref}`)).status).toBe(404);
    expect((await call("GET", "me", { token: author })).status).toBe(401);
  });

  it("fans alerts out to people whose area matches", async () => {
    const watcher = await signIn("gina");
    const put = await call("PUT", "me/alerts/settings", {
      token: watcher,
      body: { enabled: true, area: { label: "Cilandak, South Jakarta", lat: -6.2615, lng: 106.8106 }, radiusKm: 5, animals: ["cat"] },
    });
    expect(put.json.data.enabled).toBe(true);
    const author = await signIn("hari");
    await call("POST", "reports", { token: author, body: report() });
    const feed = await call("GET", "me/alerts", { token: watcher });
    expect(feed.json.data.unread).toBe(1);
    expect(await call("POST", "me/alerts/read", { token: watcher, body: {} })).toMatchObject({ status: 204 });
  });

  it("publishes impact only after verification, per currency", async () => {
    const admin = await adminToken();
    const period = (await call("POST", "admin/impact/periods", { token: admin, body: { label: "Q4 2026", summary: "Year end" } })).json.data;
    const alloc = (
      await call("POST", `admin/impact/periods/${period.id}/allocations`, {
        token: admin,
        body: { beneficiary: "Happy Paws Shelter", category: "shelter", amount: 1500000, currency: "IDR", transferDate: "2026-10-20" },
      })
    ).json.data;
    const stage = (to: string) => call("POST", `admin/impact/allocations/${alloc.id}/stage`, { token: admin, body: { to } });
    expect((await stage("published")).status).toBe(422);
    expect((await stage("verified")).status).toBe(422);
    await call("PATCH", `admin/impact/allocations/${alloc.id}`, {
      token: admin,
      body: { transferConfirmed: true, evidence: ["evidence/receipt.pdf"], redactionChecked: true },
    });
    expect((await stage("verified")).status).toBe(200);
    expect((await stage("published")).status).toBe(200);

    expect((await call("GET", "impact")).json.data.totals).toEqual([]); // period still a draft
    await call("PATCH", `admin/impact/periods/${period.id}`, { token: admin, body: { published: true } });
    const overview = (await call("GET", "impact")).json.data;
    expect(overview.totals).toEqual([{ currency: "IDR", amount: 1500000 }]);
    expect((await call("GET", `impact/allocations/${alloc.id}`)).json.data.verified).toBe(true);
  });

  it("takes support and privacy requests and exposes them masked to admins", async () => {
    const sent = await call("POST", "support", { body: { topic: "bug", email: "someone@gmail.com", message: "The map does not load for me." } });
    expect(sent.status).toBe(201);
    const priv = await call("POST", "privacy-requests", { body: { type: "deletion", email: "someone@gmail.com", details: "Please delete my data." } });
    expect(priv.json.data.ref).toMatch(/^PRV-/);

    const admin = await adminToken();
    const inbox = await call("GET", "admin/support", { token: admin });
    expect(inbox.json.data.items[0].from).toBe("s***@gmail.com");
    const reqs = await call("GET", "admin/privacy-requests", { token: admin });
    const id = reqs.json.data.items[0].id as string;
    expect((await call("PATCH", `admin/privacy-requests/${id}`, { token: admin, body: { status: "completed" } })).status).toBe(422);
    expect((await call("PATCH", `admin/privacy-requests/${id}`, { token: admin, body: { emailMatchesAccount: true, status: "completed" } })).status).toBe(200);
  });
});
