import {
  AdminFlagsQuerySchema,
  AdminReportsQuerySchema,
  AdminUpdatesQuerySchema,
  ReportDecisionSchema,
  ResolveFlagSchema,
  UpdateDecisionSchema,
} from "@/contracts";
import { ValidationError } from "@/backend/shared/domain/errors";
import { requireAdmin, type Authenticator } from "@/backend/shared/presentation/auth";
import { ok, parseJson, parseQuery } from "@/backend/shared/presentation/http";
import type { ModerationService } from "../application/moderation.usecases";
import type { ReportStats } from "../application/stats.usecases";

export class ModerationController {
  constructor(
    private readonly auth: Authenticator,
    private readonly moderation: ModerationService,
    private readonly stats: ReportStats,
  ) {}

  listReports = async (request: Request) => {
    await requireAdmin(request, this.auth);
    return ok(await this.moderation.listReports(parseQuery(request, AdminReportsQuerySchema)));
  };

  review = async (request: Request, ref: string) => {
    await requireAdmin(request, this.auth);
    return ok(await this.moderation.reviewReport(ref));
  };

  decide = async (request: Request, ref: string) => {
    const admin = await requireAdmin(request, this.auth);
    return ok(await this.moderation.decideReport(admin, ref, await parseJson(request, ReportDecisionSchema)));
  };

  listUpdates = async (request: Request) => {
    await requireAdmin(request, this.auth);
    return ok(await this.moderation.listUpdates(parseQuery(request, AdminUpdatesQuerySchema)));
  };

  decideUpdate = async (request: Request, id: string) => {
    const admin = await requireAdmin(request, this.auth);
    return ok(await this.moderation.decideUpdate(admin, id, await parseJson(request, UpdateDecisionSchema)));
  };

  listFlags = async (request: Request) => {
    await requireAdmin(request, this.auth);
    return ok(await this.moderation.listFlags(parseQuery(request, AdminFlagsQuerySchema)));
  };

  resolveFlag = async (request: Request, number: string) => {
    const admin = await requireAdmin(request, this.auth);
    const n = Number(number);
    if (!Number.isInteger(n)) throw new ValidationError("Invalid flag number");
    return ok(await this.moderation.resolveFlag(admin, n, await parseJson(request, ResolveFlagSchema)));
  };

  dashboardStats = () => this.stats.dashboard();
}
