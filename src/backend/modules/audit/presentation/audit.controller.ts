import { AuditQuerySchema } from "@/contracts";
import { requireAdmin, type Authenticator } from "@/backend/shared/presentation/auth";
import { csvResponse, ok, parseQuery } from "@/backend/shared/presentation/http";
import type { ListAudit } from "../application/audit.usecases";

export class AuditController {
  constructor(
    private readonly auth: Authenticator,
    private readonly listAudit: ListAudit,
  ) {}

  list = async (request: Request) => {
    await requireAdmin(request, this.auth);
    return ok(await this.listAudit.execute(parseQuery(request, AuditQuerySchema)));
  };

  exportCsv = async (request: Request) => {
    await requireAdmin(request, this.auth);
    const query = parseQuery(request, AuditQuerySchema);
    const { items } = await this.listAudit.execute({ ...query, limit: 500, offset: 0 });
    return csvResponse("audit-log.csv", [
      ["time", "actor", "action", "target", "reason"],
      ...items.map((r) => [r.at, r.actor, r.action, r.target, r.reason ?? ""]),
    ]);
  };
}
