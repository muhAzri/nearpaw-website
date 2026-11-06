import { describe, expect, it } from "vitest";
import { InMemoryRateLimiter } from "@/backend/shared/infrastructure/rate-limiter";
import { Register } from "../modules/identity/application/auth.usecases";
import { DevAuthProvider } from "../modules/identity/infrastructure/dev-auth.provider";

const PASSWORD = "Kopi-Hangat-2026";

describe("Register", () => {
  it("asks for email confirmation while the provider requires it", async () => {
    const register = new Register(new DevAuthProvider(false), new InMemoryRateLimiter());
    await expect(register.execute({ email: "budi.santoso93@nearpaw.test", password: PASSWORD })).resolves.toEqual({
      status: "verification_required",
      email: "b***@nearpaw.test",
    });
  });

  it("reports the account as registered when the provider doesn't require confirmation", async () => {
    const register = new Register(new DevAuthProvider(true), new InMemoryRateLimiter());
    await expect(register.execute({ email: "rina.wijaya91@nearpaw.test", password: PASSWORD })).resolves.toEqual({
      status: "registered",
      email: "r***@nearpaw.test",
    });
  });
});
