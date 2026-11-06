import { createHash, randomBytes } from "node:crypto";
import type { RefreshTokenCodec } from "../application/ports";

/** 256 random bits, prefixed so a leaked value is easy to recognise in logs and secret scanners. */
export class CryptoRefreshTokenCodec implements RefreshTokenCodec {
  generate() {
    const token = `rt_${randomBytes(32).toString("base64url")}`;
    return { token, hash: this.hash(token) };
  }

  hash(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}
