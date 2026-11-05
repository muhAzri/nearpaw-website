import { AlertFeedQuerySchema, AlertSettingsSchema, MarkReadSchema, RegisterDeviceSchema } from "@/contracts";
import { requireUser, type Authenticator } from "@/backend/shared/presentation/auth";
import { noContent, ok, parseJson, parseQuery } from "@/backend/shared/presentation/http";
import type { AlertsService } from "../application/alerts.usecases";

export class AlertsController {
  constructor(
    private readonly auth: Authenticator,
    private readonly service: AlertsService,
  ) {}

  settings = async (request: Request) => ok(await this.service.settings(await requireUser(request, this.auth)));

  updateSettings = async (request: Request) => {
    const user = await requireUser(request, this.auth);
    const body = await parseJson(request, AlertSettingsSchema);
    return ok(await this.service.updateSettings(user, body));
  };

  feed = async (request: Request) => {
    const user = await requireUser(request, this.auth);
    const q = parseQuery(request, AlertFeedQuerySchema);
    return ok(await this.service.feed(user, { unreadOnly: q.unread === "true", limit: q.limit, offset: q.offset }));
  };

  markRead = async (request: Request) => {
    const user = await requireUser(request, this.auth);
    const body = await parseJson(request, MarkReadSchema);
    await this.service.markRead(user, body.ids);
    return noContent();
  };

  registerDevice = async (request: Request) => {
    const user = await requireUser(request, this.auth);
    await this.service.registerDevice(user, (await parseJson(request, RegisterDeviceSchema)).token);
    return noContent();
  };

  unregisterDevice = async (request: Request) => {
    const user = await requireUser(request, this.auth);
    await this.service.unregisterDevice(user, (await parseJson(request, RegisterDeviceSchema)).token);
    return noContent();
  };
}
