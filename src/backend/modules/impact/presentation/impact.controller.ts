import { AllocationInputSchema, AllocationPatchSchema, AllocationStageSchema, PeriodInputSchema } from "@/contracts";
import { z } from "zod";
import { requireAdmin, type Authenticator } from "@/backend/shared/presentation/auth";
import { created, ok, parseJson } from "@/backend/shared/presentation/http";
import type { ImpactAdmin, ImpactPublic } from "../application/impact.usecases";

const PeriodPatchSchema = PeriodInputSchema.partial().extend({ published: z.boolean().optional() });

export class ImpactController {
  constructor(
    private readonly auth: Authenticator,
    private readonly pub: ImpactPublic,
    private readonly admin: ImpactAdmin,
  ) {}

  overview = async () => ok(await this.pub.overview());
  period = async (_r: Request, id: string) => ok(await this.pub.period(id));
  allocation = async (_r: Request, id: string) => ok(await this.pub.allocation(id));

  listPeriods = async (request: Request) => {
    await requireAdmin(request, this.auth);
    return ok(await this.admin.listPeriods());
  };

  createPeriod = async (request: Request) => {
    const admin = await requireAdmin(request, this.auth);
    return created(await this.admin.createPeriod(admin, await parseJson(request, PeriodInputSchema)));
  };

  updatePeriod = async (request: Request, id: string) => {
    const admin = await requireAdmin(request, this.auth);
    return ok(await this.admin.updatePeriod(admin, id, await parseJson(request, PeriodPatchSchema)));
  };

  listAllocations = async (request: Request, periodId: string) => {
    await requireAdmin(request, this.auth);
    return ok(await this.admin.listAllocations(periodId));
  };

  createAllocation = async (request: Request, periodId: string) => {
    const admin = await requireAdmin(request, this.auth);
    return created(await this.admin.createAllocation(admin, periodId, await parseJson(request, AllocationInputSchema)));
  };

  updateAllocation = async (request: Request, id: string) => {
    const admin = await requireAdmin(request, this.auth);
    return ok(await this.admin.updateAllocation(admin, id, await parseJson(request, AllocationPatchSchema)));
  };

  stageAllocation = async (request: Request, id: string) => {
    const admin = await requireAdmin(request, this.auth);
    return ok(await this.admin.stage(admin, id, (await parseJson(request, AllocationStageSchema)).to));
  };
}
