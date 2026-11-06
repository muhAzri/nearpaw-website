import type { LoginAttemptStore } from "../application/ports";
import type { LoginState } from "../domain/login-policy";

export class InMemoryLoginAttempts implements LoginAttemptStore {
  private readonly state = new Map<string, LoginState>();
  get(key: string) {
    return this.state.get(key);
  }
  set(key: string, s: LoginState) {
    this.state.set(key, s);
  }
  clear(key: string) {
    this.state.delete(key);
  }
}
