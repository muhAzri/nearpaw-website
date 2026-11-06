import type { Page } from "@/backend/shared/domain/page";
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
  /** Creates the user unless one with that id exists; returns whichever row is stored. Safe under concurrent first requests. */
  insertIfAbsent(user: User): Promise<User>;
  search(criteria: UserSearch): Promise<Page<User>>;
}

export interface BlockRepository {
  add(blockerId: string, blockedId: string): Promise<void>;
  remove(blockerId: string, blockedId: string): Promise<void>;
  listBlocked(blockerId: string): Promise<string[]>;
  countBlockedBy(blockedId: string): Promise<number>;
  removeAllInvolving(userId: string): Promise<void>;
}
