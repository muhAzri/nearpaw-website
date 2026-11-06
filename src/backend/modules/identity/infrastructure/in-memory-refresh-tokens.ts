import type { RefreshToken, RevokedReason } from "../domain/refresh-token";
import type { RefreshTokenRepository } from "../domain/repositories";

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private readonly tokens = new Map<string, RefreshToken>();

  async save(token: RefreshToken) {
    this.tokens.set(token.hash, token);
    // Expired tokens are useless; keep the dev store from growing forever.
    if (this.tokens.size % 500 === 0) {
      const now = Date.now();
      for (const [hash, t] of this.tokens) if (t.expiresAt.getTime() < now) this.tokens.delete(hash);
    }
  }

  async findByHash(hash: string) {
    return this.tokens.get(hash) ?? null;
  }

  async revoke(hash: string, reason: RevokedReason, at: Date) {
    const t = this.tokens.get(hash);
    if (t && !t.revokedAt) this.tokens.set(hash, { ...t, revokedAt: at, revokedReason: reason });
  }

  async revokeFamily(familyId: string, reason: RevokedReason, at: Date) {
    for (const [hash, t] of this.tokens) if (t.familyId === familyId && !t.revokedAt) this.tokens.set(hash, { ...t, revokedAt: at, revokedReason: reason });
  }

  async revokeAllForUser(userId: string, reason: RevokedReason, at: Date) {
    for (const [hash, t] of this.tokens) if (t.userId === userId && !t.revokedAt) this.tokens.set(hash, { ...t, revokedAt: at, revokedReason: reason });
  }
}
