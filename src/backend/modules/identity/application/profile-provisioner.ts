import type { Clock } from "@/backend/shared/application/clock";
import type { UserRepository } from "../domain/repositories";
import { DEFAULT_DISPLAY_NAME, type User } from "../domain/user";

/**
 * Finds the profile behind an auth-provider account, creating it the first time the account is seen. The account
 * (and its JWT) is the source of truth for identity, so a profile row that is missing never signs anyone out.
 */
export class ProfileProvisioner {
  constructor(
    private readonly users: UserRepository,
    private readonly clock: Clock,
    /** The account with this email becomes an admin when its profile is first created. */
    private readonly bootstrapAdminEmail: string | undefined,
  ) {}

  async ensure(identity: { id: string; email: string }): Promise<User> {
    const existing = await this.users.findById(identity.id);
    if (existing) return existing;
    const email = identity.email.toLowerCase();
    const user: User = {
      id: identity.id,
      publicNumber: await this.users.nextPublicNumber(),
      role: this.bootstrapAdminEmail?.toLowerCase() === email ? "admin" : "user",
      displayName: DEFAULT_DISPLAY_NAME,
      email: identity.email,
      status: "active",
      warnings: 0,
      createdAt: this.clock.now(),
      deletedAt: null,
      tombstoneId: null,
    };
    return this.users.insertIfAbsent(user);
  }
}
