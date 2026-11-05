import { requireAdmin, type Authenticator } from "@/backend/shared/presentation/auth";
import { ok } from "@/backend/shared/presentation/http";
import type { DashboardQuery } from "../application/dashboard.usecases";

export class DashboardController {
  constructor(
    private readonly auth: Authenticator,
    private readonly query: DashboardQuery,
  ) {}

  get = async (request: Request) => {
    await requireAdmin(request, this.auth);
    return ok(await this.query.execute());
  };
}
