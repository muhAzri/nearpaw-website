import {
  AdminLoginSchema,
  AdminUsersQuerySchema,
  DeleteAccountSchema,
  EmailOnlySchema,
  RegisterSchema,
  SignInSchema,
  UpdateProfileSchema,
  UserActionSchema,
} from "@/contracts";
import { NotFoundError, ValidationError } from "@/backend/shared/domain/errors";
import { requireAdmin, requireUser, type Authenticator } from "@/backend/shared/presentation/auth";
import { created, noContent, ok, parseJson, parseQuery } from "@/backend/shared/presentation/http";
import type { AccountService, UserAdmin } from "../application/account.usecases";
import type { AdminLogin, Register, RequestPasswordReset, ResendVerification, SignInWithPassword } from "../application/auth.usecases";

export class IdentityController {
  constructor(
    private readonly auth: Authenticator,
    private readonly registerUser: Register,
    private readonly signInUser: SignInWithPassword,
    private readonly passwordReset: RequestPasswordReset,
    private readonly resendVerification: ResendVerification,
    private readonly adminLogin: AdminLogin,
    private readonly account: AccountService,
    private readonly userAdmin: UserAdmin,
  ) {}

  register = async (request: Request) => {
    const { email, password } = await parseJson(request, RegisterSchema);
    return created(await this.registerUser.execute({ email, password }));
  };

  signIn = async (request: Request) => ok(await this.signInUser.execute(await parseJson(request, SignInSchema)));

  forgotPassword = async (request: Request) =>
    ok(await this.passwordReset.execute(await parseJson(request, EmailOnlySchema)));

  resendVerificationEmail = async (request: Request) =>
    ok(await this.resendVerification.execute(await parseJson(request, EmailOnlySchema)));

  adminSignIn = async (request: Request) =>
    ok(await this.adminLogin.execute(await parseJson(request, AdminLoginSchema)));

  me = async (request: Request) => ok(await this.account.me(await requireUser(request, this.auth)));

  updateMe = async (request: Request) => {
    const principal = await requireUser(request, this.auth);
    return ok(await this.account.rename(principal, (await parseJson(request, UpdateProfileSchema)).displayName));
  };

  deleteMe = async (request: Request) => {
    const principal = await requireUser(request, this.auth);
    const body = await parseJson(request, DeleteAccountSchema);
    await this.account.deleteAccount(principal, body.reports);
    return noContent();
  };

  listBlocked = async (request: Request) => ok(await this.account.listBlocked(await requireUser(request, this.auth)));

  unblock = async (request: Request, handle: string) => {
    const principal = await requireUser(request, this.auth);
    const n = Number(handle);
    if (!Number.isInteger(n)) throw new ValidationError("Invalid user handle");
    await this.account.unblock(principal, n);
    return noContent();
  };

  // ---- admin ----
  adminMe = async (request: Request) => {
    const principal = await requireAdmin(request, this.auth);
    return ok({ id: principal.id, role: "admin" as const });
  };

  listUsers = async (request: Request) => {
    await requireAdmin(request, this.auth);
    return ok(await this.userAdmin.search(parseQuery(request, AdminUsersQuerySchema)));
  };

  getUser = async (request: Request, id: string) => {
    await requireAdmin(request, this.auth);
    if (!id) throw new NotFoundError("User not found");
    return ok(await this.userAdmin.get(id));
  };

  userAction = async (request: Request, id: string) => {
    const admin = await requireAdmin(request, this.auth);
    const body = await parseJson(request, UserActionSchema);
    return ok(await this.userAdmin.act(admin, id, body.action, body.reason));
  };
}
