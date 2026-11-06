import { supabaseAdmin } from "@/backend/shared/infrastructure/supabase-admin";
import type { AccountRemover } from "../application/ports";

/** Deletes the account from Supabase Auth with the secret key, which also ends its sessions and refresh tokens. */
export class SupabaseAccountRemover implements AccountRemover {
  async remove(userId: string): Promise<void> {
    const { error } = await supabaseAdmin().auth.admin.deleteUser(userId);
    if (!error) return;
    if (error.status === 404 || error.code === "user_not_found") return;
    throw new Error(`auth.admin.deleteUser: ${error.message}`);
  }
}
