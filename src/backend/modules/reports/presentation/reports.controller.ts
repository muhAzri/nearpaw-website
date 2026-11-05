import {
  AddUpdateSchema,
  CreateFlagSchema,
  CreateReportSchema,
  EditReportSchema,
  ListReportsQuerySchema,
} from "@/contracts";
import { z } from "zod";
import {
  optionalPrincipal,
  requireUser,
  type Authenticator,
} from "@/backend/shared/presentation/auth";
import { created, noContent, ok, parseJson, parseQuery } from "@/backend/shared/presentation/http";
import type { FlagService } from "../application/flag.usecases";
import type { ReportService } from "../application/report.usecases";

const DetailQuery = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export class ReportsController {
  constructor(
    private readonly auth: Authenticator,
    private readonly service: ReportService,
    private readonly flags: FlagService,
  ) {}

  create = async (request: Request) => {
    const user = await requireUser(request, this.auth);
    const body = await parseJson(request, CreateReportSchema);
    const { consent: _consent, location, ...rest } = body;
    void _consent;
    return created(await this.service.create(user, { ...rest, location }));
  };

  list = async (request: Request) => {
    const viewer = await optionalPrincipal(request, this.auth);
    const q = parseQuery(request, ListReportsQuerySchema);
    const center = q.lat !== undefined && q.lng !== undefined ? { lat: q.lat, lng: q.lng } : undefined;
    return ok(
      await this.service.list(viewer, {
        center,
        radiusKm: q.radiusKm,
        sort: q.sort,
        animals: q.animal,
        conditions: q.condition,
        sinceDays: q.sinceDays,
        state: q.state,
        limit: q.limit,
        offset: q.offset,
      }),
    );
  };

  detail = async (request: Request, ref: string) => {
    const viewer = await optionalPrincipal(request, this.auth);
    const q = parseQuery(request, DetailQuery);
    const from = q.lat !== undefined && q.lng !== undefined ? { lat: q.lat, lng: q.lng } : undefined;
    return ok(await this.service.detail(viewer, ref, from));
  };

  /** Public web page behind the share link. */
  shared = async (_request: Request, ref: string) => ok(await this.service.shared(ref));

  mine = async (request: Request) => ok(await this.service.mine(await requireUser(request, this.auth)));

  myDetail = async (request: Request, ref: string) =>
    ok(await this.service.myDetail(await requireUser(request, this.auth), ref));

  edit = async (request: Request, ref: string) => {
    const user = await requireUser(request, this.auth);
    return ok(await this.service.edit(user, ref, await parseJson(request, EditReportSchema)));
  };

  close = async (request: Request, ref: string) => {
    await this.service.close(await requireUser(request, this.auth), ref);
    return noContent();
  };

  addUpdate = async (request: Request, ref: string) => {
    const user = await requireUser(request, this.auth);
    return created(await this.service.addUpdate(user, ref, await parseJson(request, AddUpdateSchema)));
  };

  myUpdates = async (request: Request) => ok(await this.service.myUpdates(await requireUser(request, this.auth)));

  blockReporter = async (request: Request, ref: string) => {
    await this.service.blockReporter(await requireUser(request, this.auth), ref);
    return noContent();
  };

  flag = async (request: Request) => {
    const user = await requireUser(request, this.auth);
    return created(await this.flags.create(user, await parseJson(request, CreateFlagSchema)));
  };
}
