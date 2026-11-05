import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Principal } from "@/backend/shared/domain/principal";
import type { TokenService } from "../application/ports";

const b64 = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

/** Stateless signed tokens: `v1.<payload>.<signature>` (HMAC-SHA256). */
export class HmacTokenService implements TokenService {
  constructor(
    private readonly secret: string,
    private readonly now: () => number = Date.now,
  ) {}

  static withEphemeralSecret() {
    // Dev only: a fresh secret per process invalidates sessions on restart.
    return new HmacTokenService(randomBytes(32).toString("hex"));
  }

  private sign(data: string) {
    return createHmac("sha256", this.secret).update(data).digest();
  }

  issue(principal: Principal, ttlSeconds: number): string {
    const iat = Math.floor(this.now() / 1000);
    const payload = b64(JSON.stringify({ sub: principal.id, role: principal.role, iat, exp: iat + ttlSeconds }));
    return `v1.${payload}.${b64(this.sign(`v1.${payload}`))}`;
  }

  verify(token: string): Principal | null {
    const [version, payload, signature] = token.split(".");
    if (version !== "v1" || !payload || !signature) return null;
    const expected = this.sign(`v1.${payload}`);
    const given = Buffer.from(signature, "base64url");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    try {
      const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
        sub?: string;
        role?: string;
        exp?: number;
      };
      if (!claims.sub || !claims.exp || claims.exp * 1000 < this.now()) return null;
      if (claims.role !== "user" && claims.role !== "admin") return null;
      return { id: claims.sub, role: claims.role };
    } catch {
      return null;
    }
  }
}
