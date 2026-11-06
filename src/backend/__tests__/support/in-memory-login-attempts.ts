import type { LoginAttemptStore } from "../../modules/identity/application/ports";
import type { LoginState } from "../../modules/identity/domain/login-policy";

export class InMemoryLoginAttempts implements LoginAttemptStore {
  private readonly state = new Map<string, LoginState>();
  async get(key: string) {
    return this.state.get(key);
  }
  async set(key: string, s: LoginState) {
    this.state.set(key, s);
  }
  async clear(key: string) {
    this.state.delete(key);
  }
}
