import { z } from "zod";
import {
  API_PREFIX,
  type AdPlacementPatchSchema,
  type AdminLoginInput,
  type AllocationInputSchema,
  type AllocationPatchSchema,
  type AppConfigPatchSchema,
  type PeriodInputSchema,
  type PrivacyRequestPatchSchema,
  type RegionInputSchema,
  type RegionPatchSchema,
  type ReportDecisionSchema,
  type ResolveFlagSchema,
  type SupportActionSchema,
  type UpdateDecisionSchema,
  type UserActionSchema,
} from "@/contracts";
import { ApiError, apiData, apiVoid } from "@/frontend/shared/lib/api-client";
import { clearAdminSession, getAdminToken } from "../lib/session";
import {
  AllocationSchema,
  AppConfigSchema,
  AuditEntrySchema,
  DashboardSchema,
  Page,
  PeriodRowSchema,
  PlacementSchema,
  PrivacyDetailSchema,
  PrivacyRowSchema,
  RegionSchema,
  ReportReviewSchema,
  ReportRowSchema,
  SessionSchema,
  SupportDetailSchema,
  SupportRowSchema,
  UpdateRowSchema,
  UserRowSchema,
  FlagRowSchema,
} from "./schemas";

type Init = Parameters<typeof apiData>[2];

/** `?a=1&b=x`, skipping empty values. */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

function authorized(init?: Init): Init {
  const token = getAdminToken();
  if (!token) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue");
  return { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` } };
}

/** A 401 from any admin call ends the session, which sends the person back to sign-in. */
async function guarded<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) clearAdminSession("expired");
    throw error;
  }
}

const get = <S extends z.ZodType>(path: string, schema: S) =>
  guarded(() => apiData(`/admin${path}`, schema, authorized()));
const send = <S extends z.ZodType>(method: "POST" | "PATCH" | "PUT", path: string, schema: S, body: unknown) =>
  guarded(() => apiData(`/admin${path}`, schema, authorized({ method, body })));

const Ref = z.object({ id: z.string() });
const e = encodeURIComponent;

export const adminApi = {
  // ---- auth ----
  login: (input: AdminLoginInput) => apiData("/admin/auth/login", SessionSchema, { method: "POST", body: input }),

  // ---- dashboard ----
  dashboard: () => get("/dashboard", DashboardSchema),

  // ---- reports ----
  reports: (q: Record<string, string | number | undefined>) => get(`/reports${qs(q)}`, Page(ReportRowSchema)),
  report: (ref: string) => get(`/reports/${e(ref)}`, ReportReviewSchema),
  decideReport: (ref: string, body: z.input<typeof ReportDecisionSchema>) =>
    send("POST", `/reports/${e(ref)}/decision`, ReportRowSchema, body),

  // ---- updates ----
  updates: (filter: string, offset: number) => get(`/updates${qs({ filter, offset })}`, Page(UpdateRowSchema)),
  decideUpdate: (id: string, body: z.input<typeof UpdateDecisionSchema>) =>
    send("POST", `/updates/${e(id)}/decision`, z.object({ id: z.string(), state: z.string() }), body),

  // ---- flags ----
  flags: (status: string, offset: number) => get(`/flags${qs({ status, offset })}`, Page(FlagRowSchema)),
  resolveFlag: (number: number, body: z.input<typeof ResolveFlagSchema>) =>
    send("POST", `/flags/${number}/resolve`, z.object({ number: z.number(), outcome: z.string(), resolvedFlags: z.number() }), body),

  // ---- users ----
  users: (q: Record<string, string | number | undefined>) => get(`/users${qs(q)}`, Page(UserRowSchema)),
  userAction: (id: string, body: z.input<typeof UserActionSchema>) =>
    send("POST", `/users/${e(id)}/action`, UserRowSchema, body),

  // ---- impact ----
  periods: () => get("/impact/periods", z.array(PeriodRowSchema)),
  createPeriod: (body: z.input<typeof PeriodInputSchema>) => send("POST", "/impact/periods", Ref, body),
  updatePeriod: (id: string, body: { label?: string; summary?: string; published?: boolean }) =>
    send("PATCH", `/impact/periods/${e(id)}`, Ref, body),
  allocations: (periodId: string) => get(`/impact/periods/${e(periodId)}/allocations`, z.array(AllocationSchema)),
  createAllocation: (periodId: string, body: z.input<typeof AllocationInputSchema>) =>
    send("POST", `/impact/periods/${e(periodId)}/allocations`, AllocationSchema, body),
  updateAllocation: (id: string, body: z.input<typeof AllocationPatchSchema>) =>
    send("PATCH", `/impact/allocations/${e(id)}`, AllocationSchema, body),
  stageAllocation: (id: string, to: "draft" | "verified" | "published") =>
    send("POST", `/impact/allocations/${e(id)}/stage`, AllocationSchema, { to }),

  // ---- regions, config, ads ----
  regions: () => get("/regions", z.array(RegionSchema)),
  createRegion: (body: z.input<typeof RegionInputSchema>) => send("POST", "/regions", RegionSchema, body),
  updateRegion: (id: string, body: z.input<typeof RegionPatchSchema>) =>
    send("PATCH", `/regions/${e(id)}`, RegionSchema, body),
  config: () => get("/config", AppConfigSchema),
  updateConfig: (body: z.input<typeof AppConfigPatchSchema>) => send("PATCH", "/config", AppConfigSchema, body),
  placements: () => get("/ad-placements", z.array(PlacementSchema)),
  setPlacement: (id: string, body: z.input<typeof AdPlacementPatchSchema>) =>
    guarded(() => apiVoid(`/admin/ad-placements/${e(id)}`, authorized({ method: "PUT", body }))),

  // ---- audit ----
  audit: (q: Record<string, string | number | undefined>) => get(`/audit${qs(q)}`, Page(AuditEntrySchema)),
  auditCsv: (q: Record<string, string | number | undefined>) => downloadCsv(`/admin/audit/export${qs(q)}`),

  // ---- support & privacy ----
  supportMessages: (q: Record<string, string | number | undefined>) => get(`/support${qs(q)}`, Page(SupportRowSchema)),
  supportMessage: (id: string) => get(`/support/${e(id)}`, SupportDetailSchema),
  supportAct: (id: string, body: z.input<typeof SupportActionSchema>) =>
    send("POST", `/support/${e(id)}/action`, SupportDetailSchema, body),
  privacyRequests: (q: Record<string, string | number | undefined>) =>
    get(`/privacy-requests${qs(q)}`, Page(PrivacyRowSchema)),
  privacyRequest: (id: string) => get(`/privacy-requests/${e(id)}`, PrivacyDetailSchema),
  updatePrivacyRequest: (id: string, body: z.input<typeof PrivacyRequestPatchSchema>) =>
    send("PATCH", `/privacy-requests/${e(id)}`, PrivacyDetailSchema, body),
};

async function downloadCsv(path: string): Promise<Blob> {
  const init = authorized();
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  return guarded(async () => {
    const response = await fetch(`${base}${API_PREFIX}${path}`, { headers: init?.headers });
    if (!response.ok) {
      throw new ApiError(response.status, "EXPORT_FAILED", response.status === 401 ? "Sign in to continue" : "The export failed.");
    }
    return response.blob();
  });
}
