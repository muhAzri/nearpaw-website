import type { Page } from "@/backend/shared/domain/page";
import type { RefreshToken, RevokedReason } from "./refresh-token";
import type { User, UserStatus } from "./user";

export interface UserSearch {
  q?: string;
  status?: UserStatus;
  limit: number;
  offset: number;
}

export interface UserRepository {
  nextPublicNumber(): Promise<number>;
  findById(id: string): Promise<User | null>;
  findByPublicNumber(n: number): Promise<User | null>;
  save(user: User): Promise<void>;
  search(criteria: UserSearch): Promise<Page<User>>;
}

export interface RefreshTokenRepository {
  save(token: RefreshToken): Promise<void>;
  findByHash(hash: string): Promise<RefreshToken | null>;
  revoke(hash: string, reason: RevokedReason, at: Date): Promise<void>;
  /** Revokes every still-valid token of the family (sign-out, or reuse detected). */
  revokeFamily(familyId: string, reason: RevokedReason, at: Date): Promise<void>;
  revokeAllForUser(userId: string, reason: RevokedReason, at: Date): Promise<void>;
}

export interface BlockRepository {
  add(blockerId: string, blockedId: string): Promise<void>;
  remove(blockerId: string, blockedId: string): Promise<void>;
  listBlocked(blockerId: string): Promise<string[]>;
  countBlockedBy(blockedId: string): Promise<number>;
  removeAllInvolving(userId: string): Promise<void>;
}
