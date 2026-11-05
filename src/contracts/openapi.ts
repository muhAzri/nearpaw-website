import { z } from "zod";
import * as C from "./index";

type Auth = "none" | "optional" | "user" | "admin";

interface Op {
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;
  tag: string;
  summary: string;
  auth?: Auth;
  body?: z.ZodType;
  query?: z.ZodType;
  /** Success status (default 200). 204 = no body. */
  status?: 200 | 201 | 204;
}

const ops: Op[] = [
  // ---- App: auth & account ----
  { method: "post", path: "/auth/register", tag: "Auth", summary: "Create an account with email + password; Supabase emails a confirmation link", body: C.RegisterSchema, status: 201 },
  { method: "post", path: "/auth/sign-in", tag: "Auth", summary: "Sign in with email + password (403 EMAIL_NOT_VERIFIED until the link is opened)", body: C.SignInSchema },
  { method: "post", path: "/auth/forgot-password", tag: "Auth", summary: "Email a password reset link (same response whether or not the account exists)", body: C.EmailOnlySchema },
  { method: "post", path: "/auth/resend-verification", tag: "Auth", summary: "Resend the confirmation email", body: C.EmailOnlySchema },
  { method: "get", path: "/me", tag: "Account", summary: "Current profile", auth: "user" },
  { method: "patch", path: "/me", tag: "Account", summary: "Change display name", auth: "user", body: C.UpdateProfileSchema },
  { method: "delete", path: "/me", tag: "Account", summary: "Delete account (keep reports anonymously or delete them)", auth: "user", body: C.DeleteAccountSchema, status: 204 },
  { method: "get", path: "/me/blocks", tag: "Account", summary: "Blocked users", auth: "user" },
  { method: "delete", path: "/me/blocks/{handle}", tag: "Account", summary: "Unblock a user", auth: "user", status: 204 },
  // ---- App: discovery ----
  { method: "get", path: "/config", tag: "Config", summary: "Launch config: min version, feature flags, active regions, enabled ads (`?regionId=`)" },
  { method: "get", path: "/regions", tag: "Config", summary: "Active regions" },
  { method: "get", path: "/reports", tag: "Reports", summary: "Nearby / latest / urgent reports", auth: "optional", query: C.ListReportsQuerySchema },
  { method: "post", path: "/reports", tag: "Reports", summary: "Create a report (goes live immediately)", auth: "user", body: C.CreateReportSchema, status: 201 },
  { method: "get", path: "/reports/{ref}", tag: "Reports", summary: "Report detail with community updates", auth: "optional" },
  { method: "post", path: "/reports/{ref}/updates", tag: "Reports", summary: "Add a community update", auth: "user", body: C.AddUpdateSchema, status: 201 },
  { method: "post", path: "/reports/{ref}/block-reporter", tag: "Reports", summary: "Block the reporter of this report", auth: "user", status: 204 },
  { method: "post", path: "/flags", tag: "Reports", summary: "Flag a report, update or user", auth: "user", body: C.CreateFlagSchema, status: 201 },
  { method: "get", path: "/me/reports", tag: "My content", summary: "My reports", auth: "user" },
  { method: "get", path: "/me/reports/{ref}", tag: "My content", summary: "My report detail and status history", auth: "user" },
  { method: "patch", path: "/me/reports/{ref}", tag: "My content", summary: "Edit description, urgency or condition", auth: "user", body: C.EditReportSchema },
  { method: "post", path: "/me/reports/{ref}/close", tag: "My content", summary: "Close my report", auth: "user", status: 204 },
  { method: "get", path: "/me/updates", tag: "My content", summary: "My community updates", auth: "user" },
  // ---- App: alerts ----
  { method: "get", path: "/me/alerts", tag: "Alerts", summary: "Alerts feed", auth: "user", query: C.AlertFeedQuerySchema },
  { method: "post", path: "/me/alerts/read", tag: "Alerts", summary: "Mark alerts read (omit ids = all)", auth: "user", body: C.MarkReadSchema, status: 204 },
  { method: "get", path: "/me/alerts/settings", tag: "Alerts", summary: "Alert settings", auth: "user" },
  { method: "put", path: "/me/alerts/settings", tag: "Alerts", summary: "Save alert settings", auth: "user", body: C.AlertSettingsSchema },
  { method: "post", path: "/me/devices", tag: "Alerts", summary: "Register push device token", auth: "user", body: C.RegisterDeviceSchema, status: 204 },
  { method: "delete", path: "/me/devices", tag: "Alerts", summary: "Unregister push device token", auth: "user", body: C.RegisterDeviceSchema, status: 204 },
  // ---- Public ----
  { method: "get", path: "/public/reports/{ref}", tag: "Public web", summary: "Shared report page data (coarse area only)" },
  { method: "get", path: "/impact", tag: "Impact", summary: "Impact overview: totals per currency, recent allocations" },
  { method: "get", path: "/impact/periods/{id}", tag: "Impact", summary: "Published period" },
  { method: "get", path: "/impact/allocations/{id}", tag: "Impact", summary: "Published allocation" },
  { method: "post", path: "/support", tag: "Public web", summary: "Send a support message", body: C.CreateSupportMessageSchema, status: 201 },
  { method: "post", path: "/privacy-requests", tag: "Public web", summary: "Submit a data/privacy request", body: C.CreatePrivacyRequestSchema, status: 201 },
  // ---- Admin ----
  { method: "post", path: "/admin/auth/login", tag: "Admin: auth", summary: "Email + password of an account with the admin role", body: C.AdminLoginSchema },
  { method: "get", path: "/admin/me", tag: "Admin: auth", summary: "Current admin", auth: "admin" },
  { method: "get", path: "/admin/dashboard", tag: "Admin: dashboard", summary: "Dashboard metrics", auth: "admin" },
  { method: "get", path: "/admin/reports", tag: "Admin: moderation", summary: "Search reports", auth: "admin", query: C.AdminReportsQuerySchema },
  { method: "get", path: "/admin/reports/{ref}", tag: "Admin: moderation", summary: "Review a report (media, reporter, duplicates, flags)", auth: "admin" },
  { method: "post", path: "/admin/reports/{ref}/decision", tag: "Admin: moderation", summary: "Keep / duplicate / hide / remove", auth: "admin", body: C.ReportDecisionSchema },
  { method: "get", path: "/admin/updates", tag: "Admin: moderation", summary: "Community updates", auth: "admin", query: C.AdminUpdatesQuerySchema },
  { method: "post", path: "/admin/updates/{id}/decision", tag: "Admin: moderation", summary: "Hide / keep an update", auth: "admin", body: C.UpdateDecisionSchema },
  { method: "get", path: "/admin/flags", tag: "Admin: moderation", summary: "Flags, oldest first", auth: "admin", query: C.AdminFlagsQuerySchema },
  { method: "post", path: "/admin/flags/{number}/resolve", tag: "Admin: moderation", summary: "Resolve a flag (none / hide / warn / restrict)", auth: "admin", body: C.ResolveFlagSchema },
  { method: "get", path: "/admin/users", tag: "Admin: users", summary: "Search users", auth: "admin", query: C.AdminUsersQuerySchema },
  { method: "get", path: "/admin/users/{id}", tag: "Admin: users", summary: "User detail", auth: "admin" },
  { method: "post", path: "/admin/users/{id}/action", tag: "Admin: users", summary: "Warn / suspend / ban / restore", auth: "admin", body: C.UserActionSchema },
  { method: "get", path: "/admin/impact/periods", tag: "Admin: impact", summary: "Periods", auth: "admin" },
  { method: "post", path: "/admin/impact/periods", tag: "Admin: impact", summary: "Create period", auth: "admin", body: C.PeriodInputSchema, status: 201 },
  { method: "patch", path: "/admin/impact/periods/{id}", tag: "Admin: impact", summary: "Edit / publish period", auth: "admin", body: C.PeriodInputSchema.partial().extend({ published: z.boolean().optional() }) },
  { method: "get", path: "/admin/impact/periods/{id}/allocations", tag: "Admin: impact", summary: "Allocations of a period", auth: "admin" },
  { method: "post", path: "/admin/impact/periods/{id}/allocations", tag: "Admin: impact", summary: "Create allocation (draft)", auth: "admin", body: C.AllocationInputSchema, status: 201 },
  { method: "patch", path: "/admin/impact/allocations/{id}", tag: "Admin: impact", summary: "Edit allocation (resets to draft)", auth: "admin", body: C.AllocationPatchSchema },
  { method: "post", path: "/admin/impact/allocations/{id}/stage", tag: "Admin: impact", summary: "Move to verified / published / draft", auth: "admin", body: C.AllocationStageSchema },
  { method: "get", path: "/admin/regions", tag: "Admin: config", summary: "Regions", auth: "admin" },
  { method: "post", path: "/admin/regions", tag: "Admin: config", summary: "Create region (inactive)", auth: "admin", body: C.RegionInputSchema, status: 201 },
  { method: "get", path: "/admin/regions/{id}", tag: "Admin: config", summary: "Region", auth: "admin" },
  { method: "patch", path: "/admin/regions/{id}", tag: "Admin: config", summary: "Edit / activate region", auth: "admin", body: C.RegionPatchSchema },
  { method: "get", path: "/admin/config", tag: "Admin: config", summary: "Feature flags and safety limits", auth: "admin" },
  { method: "patch", path: "/admin/config", tag: "Admin: config", summary: "Update flags / limits", auth: "admin", body: C.AppConfigPatchSchema },
  { method: "get", path: "/admin/ad-placements", tag: "Admin: config", summary: "Ad placements per region", auth: "admin" },
  { method: "put", path: "/admin/ad-placements/{placement}", tag: "Admin: config", summary: "Enable/disable placement in a region (locked ones refuse)", auth: "admin", body: C.AdPlacementPatchSchema, status: 204 },
  { method: "get", path: "/admin/audit", tag: "Admin: audit", summary: "Audit log", auth: "admin", query: C.AuditQuerySchema },
  { method: "get", path: "/admin/audit/export", tag: "Admin: audit", summary: "Audit log as CSV", auth: "admin", query: C.AuditQuerySchema },
  { method: "get", path: "/admin/support", tag: "Admin: support", summary: "Support inbox (emails masked)", auth: "admin", query: C.AdminInboxQuerySchema },
  { method: "get", path: "/admin/support/{id}", tag: "Admin: support", summary: "Message thread", auth: "admin" },
  { method: "post", path: "/admin/support/{id}/action", tag: "Admin: support", summary: "Reply / assign / escalate / note / resolve", auth: "admin", body: C.SupportActionSchema },
  { method: "get", path: "/admin/privacy-requests", tag: "Admin: support", summary: "Privacy requests", auth: "admin", query: C.AdminPrivacyQuerySchema },
  { method: "get", path: "/admin/privacy-requests/{id}", tag: "Admin: support", summary: "Privacy request", auth: "admin" },
  { method: "patch", path: "/admin/privacy-requests/{id}", tag: "Admin: support", summary: "Update checklist / status", auth: "admin", body: C.PrivacyRequestPatchSchema },
];

const schemaOf = (s: z.ZodType) =>
  z.toJSONSchema(s, { unrepresentable: "any", io: "input" }) as Record<string, unknown> & {
    properties?: Record<string, unknown>;
    required?: string[];
  };

const errorRef = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
});

export function buildOpenApi(serverUrl = "") {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const op of ops) {
    const params: unknown[] = [...op.path.matchAll(/\{(\w+)\}/g)].map((m) => ({
      name: m[1],
      in: "path",
      required: true,
      schema: { type: "string" },
    }));
    if (op.query) {
      const q = schemaOf(op.query);
      for (const [name, schema] of Object.entries(q.properties ?? {})) {
        params.push({ name, in: "query", required: q.required?.includes(name) ?? false, schema });
      }
    }
    const status = op.status ?? 200;
    const auth = op.auth ?? "none";
    const responses: Record<string, unknown> = {
      [status]:
        status === 204
          ? { description: "No content" }
          : {
              description: "Success",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Envelope" } } },
            },
      ...(op.body || op.query ? { "422": errorRef("Validation error") } : {}),
      ...(auth === "user" || auth === "admin" ? { "401": errorRef("Missing or invalid token") } : {}),
      ...(auth === "admin" || op.path.startsWith("/me") ? { "403": errorRef("Not allowed") } : {}),
      "429": errorRef("Rate limited"),
    };

    (paths[op.path] ??= {})[op.method] = {
      tags: [op.tag],
      summary: op.summary,
      ...(auth !== "none" && auth !== "optional" ? { security: [{ [auth === "admin" ? "adminBearer" : "userBearer"]: [] }] } : {}),
      ...(auth === "optional" ? { security: [{}, { userBearer: [] }] } : {}),
      parameters: params,
      ...(op.body ? { requestBody: { required: true, content: { "application/json": { schema: schemaOf(op.body) } } } } : {}),
      responses,
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "NearPaw API",
      version: "1.0.0",
      description:
        "Success: `{ \"data\": … }`. Errors: `{ \"error\": { code, message, details } }`. " +
        "App tokens come from `/auth/sign-in`; admin tokens from `/admin/auth/login` (account must have the admin role).",
    },
    servers: [{ url: `${serverUrl}/api/v1` }],
    tags: [...new Set(ops.map((o) => o.tag))].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        userBearer: { type: "http", scheme: "bearer", description: "App user token" },
        adminBearer: { type: "http", scheme: "bearer", description: "Admin token" },
      },
      schemas: {
        Envelope: { type: "object", required: ["data"], properties: { data: {} } },
        ApiError: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: { code: { type: "string" }, message: { type: "string" }, details: {} },
            },
          },
        },
      },
    },
  };
}
