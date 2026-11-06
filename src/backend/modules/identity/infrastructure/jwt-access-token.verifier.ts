import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { AccessTokenVerifier, VerifiedToken } from "../application/ports";

type Key = Uint8Array | JWTVerifyGetKey;

/** Verifies standard JWTs (signature, issuer, audience, expiry). Works for Supabase Auth tokens and the dev provider's. */
export class JwtAccessTokenVerifier implements AccessTokenVerifier {
  constructor(
    private readonly key: Key,
    private readonly options: { issuer: string; audience: string; algorithms: string[]; now?: () => Date },
  ) {}

  /** Supabase projects on asymmetric signing keys publish them at `/auth/v1/.well-known/jwks.json`. */
  static forSupabaseJwks(supabaseUrl: string) {
    const issuer = `${supabaseUrl.replace(/\/+$/, "")}/auth/v1`;
    return new JwtAccessTokenVerifier(createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)), {
      issuer,
      audience: "authenticated",
      algorithms: ["ES256", "RS256", "EdDSA"],
    });
  }

  /** Projects still on the legacy shared secret (Project settings > API > JWT secret). */
  static forSupabaseSecret(supabaseUrl: string, jwtSecret: string) {
    return new JwtAccessTokenVerifier(new TextEncoder().encode(jwtSecret), {
      issuer: `${supabaseUrl.replace(/\/+$/, "")}/auth/v1`,
      audience: "authenticated",
      algorithms: ["HS256"],
    });
  }

  async verify(token: string): Promise<VerifiedToken | null> {
    try {
      const { payload } = await jwtVerify(token, this.key as never, {
        issuer: this.options.issuer,
        audience: this.options.audience,
        algorithms: this.options.algorithms,
        currentDate: this.options.now?.(),
      });
      if (!payload.sub) return null;
      return { sub: payload.sub, email: typeof payload.email === "string" ? payload.email : undefined };
    } catch {
      return null;
    }
  }
}
