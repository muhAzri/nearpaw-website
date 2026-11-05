import { createPublicKey, createVerify, type JsonWebKey } from "node:crypto";
import type { AppleIdentityVerifier } from "../application/ports";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_KEYS_URL = `${APPLE_ISSUER}/auth/keys`;

interface AppleJwk extends JsonWebKey {
  kid?: string;
}

/** Verifies Sign in with Apple identity tokens (RS256) against Apple's published keys. */
export class AppleJwksVerifier implements AppleIdentityVerifier {
  private keys: { at: number; byKid: Map<string, AppleJwk> } | null = null;

  constructor(private readonly clientId: string) {}

  private async key(kid: string): Promise<AppleJwk | undefined> {
    if (!this.keys || Date.now() - this.keys.at > 3_600_000 || !this.keys.byKid.has(kid)) {
      const res = await fetch(APPLE_KEYS_URL);
      if (!res.ok) throw new Error("Could not load Apple signing keys");
      const body = (await res.json()) as { keys: AppleJwk[] };
      this.keys = { at: Date.now(), byKid: new Map(body.keys.map((k) => [k.kid ?? "", k])) };
    }
    return this.keys.byKid.get(kid);
  }

  async verify(identityToken: string) {
    const [h, p, s] = identityToken.split(".");
    if (!h || !p || !s) throw new Error("Malformed token");
    const header = JSON.parse(Buffer.from(h, "base64url").toString()) as { kid?: string; alg?: string };
    if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported token");

    const jwk = await this.key(header.kid);
    if (!jwk) throw new Error("Unknown signing key");
    const valid = createVerify("RSA-SHA256")
      .update(`${h}.${p}`)
      .verify(createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(s, "base64url"));
    if (!valid) throw new Error("Bad signature");

    const claims = JSON.parse(Buffer.from(p, "base64url").toString()) as {
      iss?: string;
      aud?: string;
      exp?: number;
      sub?: string;
      email?: string;
    };
    if (claims.iss !== APPLE_ISSUER || claims.aud !== this.clientId || !claims.sub) throw new Error("Bad claims");
    if (!claims.exp || claims.exp * 1000 < Date.now()) throw new Error("Expired");
    return { sub: claims.sub, email: claims.email ?? null };
  }
}

/** Development only: accepts `dev:<subject>[:<email>]` so the flow works without Apple. */
export class DevIdentityVerifier implements AppleIdentityVerifier {
  async verify(identityToken: string) {
    const [prefix, sub, email] = identityToken.split(":");
    if (prefix !== "dev" || !sub) throw new Error("Use a dev:<subject> token in development");
    return { sub, email: email ?? null };
  }
}
