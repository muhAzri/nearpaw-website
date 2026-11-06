import type { SupabaseClient } from "@supabase/supabase-js";
import { check, unwrap } from "@/backend/shared/infrastructure/supabase-admin";
import type { BlockRepository } from "../domain/repositories";

/** `user_blocks` table through the secret key. */
export class SupabaseBlockRepository implements BlockRepository {
  constructor(private readonly db: SupabaseClient) {}

  async add(blockerId: string, blockedId: string) {
    check(
      await this.db.from("user_blocks").upsert({ blocker_id: blockerId, blocked_id: blockedId }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true }),
      "blocks.add",
    );
  }

  async remove(blockerId: string, blockedId: string) {
    check(await this.db.from("user_blocks").delete().eq("blocker_id", blockerId).eq("blocked_id", blockedId), "blocks.remove");
  }

  async listBlocked(blockerId: string) {
    const rows = unwrap(await this.db.from("user_blocks").select("blocked_id").eq("blocker_id", blockerId).order("created_at"), "blocks.list");
    return (rows as { blocked_id: string }[]).map((r) => r.blocked_id);
  }

  async countBlockedBy(blockedId: string) {
    const { count, error } = await this.db.from("user_blocks").select("*", { count: "exact", head: true }).eq("blocked_id", blockedId);
    if (error) throw new Error(`blocks.count: ${error.message}`);
    return count ?? 0;
  }

  async removeAllInvolving(userId: string) {
    check(await this.db.from("user_blocks").delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`), "blocks.removeAll");
  }
}
