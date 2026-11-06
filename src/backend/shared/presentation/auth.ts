import { ForbiddenError, UnauthorizedError } from "@/backend/shared/domain/errors";
import type { Principal } from "@/backend/shared/domain/principal";

/** Resolves a bearer token to a principal (null = invalid/expired/revoked). */
export interface Authenticator {
  authenticate(token: string): Promise<Principal | null>;
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function optionalPrincipal(request: Request, auth: Authenticator): Promise<Principal | null> {
  const token = bearerToken(request);
  return token ? auth.authenticate(token) : null;
}

export async function requireUser(request: Request, auth: Authenticator): Promise<Principal> {
  const principal = await optionalPrincipal(request, auth);
  if (!principal) throw new UnauthorizedError("Sign in to continue");
  return principal; // admins are people too: they can use the app with the same account
}

export async function requireAdmin(request: Request, auth: Authenticator): Promise<Principal> {
  const principal = await optionalPrincipal(request, auth);
  if (!principal) throw new UnauthorizedError("Sign in to continue");
  if (principal.role !== "admin") throw new ForbiddenError("Admin access required");
  return principal;
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
