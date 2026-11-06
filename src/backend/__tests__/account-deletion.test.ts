import { describe, expect, it, vi } from "vitest";
import { AccountService } from "../modules/identity/application/account.usecases";
import type { AccountRemover } from "../modules/identity/application/ports";
import type { BlockRepository, UserRepository } from "../modules/identity/domain/repositories";
import type { User } from "../modules/identity/domain/user";

const USER = { id: "9f1c2d3e-0000-4000-8000-000000000001", email: "budi.santoso93@gmail.com", displayName: "Budi", status: "active", role: "user" } as User;

function build(remover: AccountRemover) {
  const saved: User[] = [];
  const users = { findById: async () => USER, save: async (u: User) => void saved.push(u) } as unknown as UserRepository;
  const blocks = { removeAllInvolving: async () => {} } as unknown as BlockRepository;
  const cleaner = { handleReports: async () => {}, removeAlertData: async () => {} };
  const audit = { record: vi.fn(async () => {}) };
  const service = new AccountService(users, blocks, cleaner, remover, audit, { now: () => new Date("2026-11-06T10:00:00Z") });
  return { service, saved, audit };
}

describe("AccountService.deleteAccount", () => {
  it("anonymises the profile and then erases the login record", async () => {
    const calls: string[] = [];
    const { service, saved } = build({ remove: async (id) => void calls.push(id) });

    await service.deleteAccount({ id: USER.id, role: "user" }, "keep_anonymous");

    expect(saved[0]).toMatchObject({ email: null, displayName: "Deleted user", status: "deleted" });
    expect(calls).toEqual([USER.id]);
  });

  it("still succeeds when the provider fails, and leaves an audit trail without personal data", async () => {
    const { service, audit } = build({ remove: async () => { throw new Error("auth down"); } });

    await expect(service.deleteAccount({ id: USER.id, role: "user" }, "delete")).resolves.toBeUndefined();

    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "account.auth_removal_failed", target: USER.id }));
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain("budi.santoso93");
  });
});
