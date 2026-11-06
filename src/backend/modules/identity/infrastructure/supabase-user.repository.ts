import type { SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@/backend/shared/domain/page";
import { check, unwrap } from "@/backend/shared/infrastructure/supabase-admin";
import type { UserRepository, UserSearch } from "../domain/repositories";
import type { User } from "../domain/user";

export interface UserRow {
  id: string;
  public_number: number;
  role: "user" | "admin";
  display_name: string;
  email: string | null;
  status: User["status"];
  warnings: number;
  created_at: string;
  deleted_at: string | null;
  tombstone_id: string | null;
}

export const userFromRow = (r: UserRow): User => ({
  id: r.id,
  publicNumber: r.public_number,
  role: r.role,
  displayName: r.display_name,
  email: r.email,
  status: r.status,
  warnings: r.warnings,
  createdAt: new Date(r.created_at),
  deletedAt: r.deleted_at ? new Date(r.deleted_at) : null,
  tombstoneId: r.tombstone_id,
});

export const userToRow = (u: User): UserRow => ({
  id: u.id,
  public_number: u.publicNumber,
  role: u.role,
  display_name: u.displayName,
  email: u.email,
  status: u.status,
  warnings: u.warnings,
  created_at: u.createdAt.toISOString(),
  deleted_at: u.deletedAt?.toISOString() ?? null,
  tombstone_id: u.tombstoneId,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `users` table through the secret key. */
export class SupabaseUserRepository implements UserRepository {
  constructor(private readonly db: SupabaseClient) {}

  async nextPublicNumber(): Promise<number> {
    return unwrap(await this.db.rpc("next_user_public_number"), "users.nextPublicNumber") as number;
  }

  async findById(id: string): Promise<User | null> {
    if (!UUID.test(id)) return null;
    const row = unwrap(await this.db.from("users").select("*").eq("id", id).maybeSingle<UserRow>(), "users.findById");
    return row ? userFromRow(row) : null;
  }

  async findByPublicNumber(n: number): Promise<User | null> {
    const row = unwrap(await this.db.from("users").select("*").eq("public_number", n).maybeSingle<UserRow>(), "users.findByPublicNumber");
    return row ? userFromRow(row) : null;
  }

  async save(user: User): Promise<void> {
    check(await this.db.from("users").upsert(userToRow(user), { onConflict: "id" }), "users.save");
  }

  /** Concurrent first requests for the same account both try to create it; the loser keeps the winner's row. */
  async insertIfAbsent(user: User): Promise<User> {
    check(await this.db.from("users").upsert(userToRow(user), { onConflict: "id", ignoreDuplicates: true }), "users.insertIfAbsent");
    return (await this.findById(user.id)) ?? user;
  }

  async search(c: UserSearch): Promise<Page<User>> {
    let query = this.db.from("users").select("*", { count: "exact" });
    if (c.status) query = query.eq("status", c.status);
    const q = c.q?.toLowerCase().replace(/^community\s*#?/, "").replace("#", "").trim();
    if (q) {
      if (/^\d+$/.test(q)) query = query.eq("public_number", Number(q));
      else if (UUID.test(q)) query = query.eq("id", q);
      else query = query.ilike("tombstone_id", `%${q.replace(/[%_]/g, "")}%`);
    }
    const { data, error, count } = await query.order("created_at", { ascending: false }).range(c.offset, c.offset + c.limit - 1);
    if (error) throw new Error(`users.search: ${error.message}`);
    return { items: ((data ?? []) as UserRow[]).map(userFromRow), total: count ?? 0 };
  }
}
