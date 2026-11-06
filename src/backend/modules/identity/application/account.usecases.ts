import type { AuditRecorder } from "@/backend/shared/application/audit";
import type { Clock } from "@/backend/shared/application/clock";
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from "@/backend/shared/domain/errors";
import { actorOf, SYSTEM_ACTOR, type Principal } from "@/backend/shared/domain/principal";
import type { BlockRepository, UserRepository } from "../domain/repositories";
import { anonymize, applyAction, canContribute, userLabel, validateDisplayName, type User, type UserAction } from "../domain/user";
import { toProfile } from "./auth.usecases";
import type { AccountDataCleaner, AccountRemover, UserActivityReader } from "./ports";

async function requireUser(users: UserRepository, id: string): Promise<User> {
  const user = await users.findById(id);
  if (!user || user.status === "deleted") throw new UnauthorizedError("Account not found");
  return user;
}

export class AccountService {
  constructor(
    private readonly users: UserRepository,
    private readonly blocks: BlockRepository,
    private readonly cleaner: AccountDataCleaner,
    private readonly accounts: AccountRemover,
    private readonly audit: AuditRecorder,
    private readonly clock: Clock,
  ) {}

  async me(principal: Principal) {
    return toProfile(await requireUser(this.users, principal.id));
  }

  async rename(principal: Principal, displayName: string) {
    const user = await requireUser(this.users, principal.id);
    const next = { ...user, displayName: validateDisplayName(displayName) };
    await this.users.save(next);
    return toProfile(next);
  }

  async listBlocked(principal: Principal) {
    const ids = await this.blocks.listBlocked(principal.id);
    const users = await Promise.all(ids.map((id) => this.users.findById(id)));
    return users
      .filter((u): u is User => !!u)
      .map((u) => ({ handle: u.publicNumber, label: `Community member #${u.publicNumber}` }));
  }

  async unblock(principal: Principal, handle: number) {
    const target = await this.users.findByPublicNumber(handle);
    if (target) await this.blocks.remove(principal.id, target.id);
  }

  async deleteAccount(principal: Principal, reports: "keep_anonymous" | "delete") {
    const user = await requireUser(this.users, principal.id);
    await this.cleaner.handleReports(user.id, reports);
    await this.cleaner.removeAlertData(user.id);
    await this.blocks.removeAllInvolving(user.id);
    await this.users.save(anonymize(user, this.clock.now()));
    // The profile is now anonymised and marked deleted: the authenticator and token refresh both reject it from here on.
    // Erase the provider's login record last. The deletion above already succeeded and cannot be retried (the account is
    // gone for the caller), so a failure here is recorded for follow-up instead of being reported as a failed deletion.
    try {
      await this.accounts.remove(user.id);
    } catch {
      await this.audit.record({ actor: SYSTEM_ACTOR, action: "account.auth_removal_failed", target: user.id }).catch(() => {});
    }
  }
}

/** Read/command side other modules use through ports. */
export class UserQueries {
  constructor(
    private readonly users: UserRepository,
    private readonly blocks: BlockRepository,
    private readonly clock: Clock,
  ) {}

  async assertCanContribute(userId: string): Promise<void> {
    const user = await requireUser(this.users, userId);
    if (!canContribute(user.status)) {
      throw new ForbiddenError("This account can't post right now");
    }
  }

  async reporterSummary(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) return null;
    return {
      label: user.status === "deleted" ? "Deleted user" : user.displayName,
      handle: user.publicNumber,
      status: user.status,
      accountAgeDays: Math.floor((this.clock.now().getTime() - user.createdAt.getTime()) / 86_400_000),
    };
  }

  async blockedIds(viewerId: string): Promise<Set<string>> {
    return new Set(await this.blocks.listBlocked(viewerId));
  }

  async block(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) throw new ValidationError("You can't block yourself");
    if (!(await this.users.findById(blockedId))) throw new NotFoundError("User not found");
    await this.blocks.add(blockerId, blockedId);
  }

  async resolveHandle(handle: number): Promise<string | null> {
    return (await this.users.findByPublicNumber(handle))?.id ?? null;
  }

  /** Used when a flag is resolved with warn / restrict. */
  async sanction(userId: string, action: "warn" | "restrict"): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user || user.status === "deleted") return;
    await this.users.save(action === "warn" ? applyAction(user, "warn") : { ...user, status: user.status === "banned" ? "banned" : "restricted" });
  }

  async publicLabel(userId: string): Promise<string> {
    const user = await this.users.findById(userId);
    return user ? userLabel(user) : "Unknown user";
  }
}

export class UserAdmin {
  constructor(
    private readonly users: UserRepository,
    private readonly blocks: BlockRepository,
    private readonly activity: UserActivityReader,
    private readonly audit: AuditRecorder,
  ) {}

  private async row(user: User) {
    const [activity, blocksAgainst] = await Promise.all([this.activity.activity(user.id), this.blocks.countBlockedBy(user.id)]);
    return {
      id: user.id,
      handle: user.publicNumber,
      label: userLabel(user),
      status: user.status,
      warnings: user.warnings,
      reports: activity.reports,
      updates: activity.updates,
      flagsAgainst: activity.flagsAgainst,
      blocksAgainst: user.status === "deleted" ? null : blocksAgainst,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async search(criteria: { q?: string; status?: User["status"]; limit: number; offset: number }) {
    const page = await this.users.search(criteria);
    return { items: await Promise.all(page.items.map((u) => this.row(u))), total: page.total };
  }

  async get(id: string) {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError("User not found");
    return this.row(user);
  }

  async act(admin: Principal, id: string, action: UserAction, reason: string) {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError("User not found");
    if (action === "restore" && user.status === "active") throw new ConflictError("User is already active");
    const next = applyAction(user, action);
    await this.users.save(next);
    await this.audit.record({ actor: actorOf(admin), action: `user.${action}`, target: userLabel(user), reason });
    return this.row(next);
  }
}
