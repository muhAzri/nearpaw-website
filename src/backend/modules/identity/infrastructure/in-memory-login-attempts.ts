import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { AdminAccount, AdminDirectory, LoginAttemptStore } from "../application/ports";
import type { LoginState } from "../domain/login-policy";

const digest = (s: string) => createHash("sha256").update(s).digest();

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of input.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s), accepting one step of clock drift. */
export function totpMatches(secretBase32: string, code: string, now: Date): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const key = base32Decode(secretBase32);
  const counter = Math.floor(now.getTime() / 30_000);
  return [-1, 0, 1].some((drift) => {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(counter + drift));
    const hmac = createHmac("sha1", key).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const value = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
    const expected = digest(value.toString().padStart(6, "0"));
    return timingSafeEqual(expected, digest(code));
  });
}

export class EnvAdminDirectory implements AdminDirectory {
  constructor(private readonly cfg: { email?: string; password?: string; totpSecret?: string }) {}

  find(email: string): AdminAccount | null {
    const { email: adminEmail, password, totpSecret } = this.cfg;
    if (!adminEmail || !password || !totpSecret || adminEmail.toLowerCase() !== email.toLowerCase()) return null;
    return {
      id: `adm_${digest(adminEmail.toLowerCase()).toString("hex").slice(0, 8)}`,
      checkPassword: (given) => timingSafeEqual(digest(password), digest(given)),
      checkTotp: (code, now) => totpMatches(totpSecret, code, now),
    };
  }
}

export class InMemoryLoginAttempts implements LoginAttemptStore {
  private readonly state = new Map<string, LoginState>();
  get(key: string) {
    return this.state.get(key);
  }
  set(key: string, s: LoginState) {
    this.state.set(key, s);
  }
  clear(key: string) {
    this.state.delete(key);
  }
}
