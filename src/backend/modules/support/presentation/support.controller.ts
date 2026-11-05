import {
  AdminInboxQuerySchema,
  AdminPrivacyQuerySchema,
  CreatePrivacyRequestSchema,
  CreateSupportMessageSchema,
  PrivacyRequestPatchSchema,
  SupportActionSchema,
} from "@/contracts";
import { clientIp, requireAdmin, type Authenticator } from "@/backend/shared/presentation/auth";
import { created, ok, parseJson, parseQuery } from "@/backend/shared/presentation/http";
import type { SupportAdmin, SupportPublic } from "../application/support.usecases";

export class SupportController {
  constructor(
    private readonly auth: Authenticator,
    private readonly pub: SupportPublic,
    private readonly admin: SupportAdmin,
  ) {}

  submitMessage = async (request: Request) => {
    const { website: _hp, ...body } = await parseJson(request, CreateSupportMessageSchema);
    void _hp;
    return created(await this.pub.submitMessage(body, clientIp(request)));
  };

  submitPrivacyRequest = async (request: Request) => {
    const { website: _hp, ...body } = await parseJson(request, CreatePrivacyRequestSchema);
    void _hp;
    return created(await this.pub.submitPrivacyRequest(body, clientIp(request)));
  };

  listMessages = async (request: Request) => {
    await requireAdmin(request, this.auth);
    return ok(await this.admin.listMessages(parseQuery(request, AdminInboxQuerySchema)));
  };

  getMessage = async (request: Request, id: string) => {
    await requireAdmin(request, this.auth);
    return ok(await this.admin.getMessage(id));
  };

  act = async (request: Request, id: string) => {
    const admin = await requireAdmin(request, this.auth);
    return ok(await this.admin.act(admin, id, await parseJson(request, SupportActionSchema)));
  };

  listPrivacy = async (request: Request) => {
    await requireAdmin(request, this.auth);
    return ok(await this.admin.listPrivacy(parseQuery(request, AdminPrivacyQuerySchema)));
  };

  getPrivacy = async (request: Request, id: string) => {
    await requireAdmin(request, this.auth);
    return ok(await this.admin.getPrivacy(id));
  };

  updatePrivacy = async (request: Request, id: string) => {
    const admin = await requireAdmin(request, this.auth);
    return ok(await this.admin.updatePrivacy(admin, id, await parseJson(request, PrivacyRequestPatchSchema)));
  };
}
