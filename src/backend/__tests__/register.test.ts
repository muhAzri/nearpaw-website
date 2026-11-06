import { describe, expect, it } from "vitest";
import { InMemoryRateLimiter } from "./support/in-memory-rate-limiter";
import { Register } from "../modules/identity/application/auth.usecases";
import { FakeAuthProvider } from "./support/fake-auth-provider";

const PASSWORD = "Kopi-Hangat-2026";

describe("Register", () => {
  it("asks for email confirmation while the provider requires it", async () => {
    const register = new Register(new FakeAuthProvider(false), new InMemoryRateLimiter());
    await expect(register.execute({ email: "budi.santoso93@nearpaw.test", password: PASSWORD })).resolves.toEqual({
      status: "verification_required",
      email: "b***@nearpaw.test",
    });
  });

  it("reports the account as registered when the provider doesn't require confirmation", async () => {
    const register = new Register(new FakeAuthProvider(true), new InMemoryRateLimiter());
    await expect(register.execute({ email: "rina.wijaya91@nearpaw.test", password: PASSWORD })).resolves.toEqual({
      status: "registered",
      email: "r***@nearpaw.test",
    });
  });
});
