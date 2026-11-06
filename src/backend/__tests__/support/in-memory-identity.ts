import type { Page } from "@/backend/shared/domain/page";
import type { BlockRepository, UserRepository, UserSearch } from "../domain/repositories";
import { userLabel, type User } from "../domain/user";

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();
  private counter = 1000;

  async nextPublicNumber() {
    return ++this.counter;
  }
  async findById(id: string) {
    return this.users.get(id) ?? null;
  }
  async findByPublicNumber(n: number) {
    return [...this.users.values()].find((u) => u.publicNumber === n) ?? null;
  }
  async save(user: User) {
    this.users.set(user.id, user);
  }
  async insertIfAbsent(user: User) {
    const existing = this.users.get(user.id);
    if (existing) return existing;
    this.users.set(user.id, user);
    return user;
  }
  async search(c: UserSearch): Promise<Page<User>> {
    const q = c.q?.toLowerCase().replace(/^community\s*#?/, "").replace("#", "");
    const hits = [...this.users.values()]
      .filter((u) => (!c.status || u.status === c.status) && (!q || userLabel(u).toLowerCase().includes(q) || u.id.startsWith(q)))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { items: hits.slice(c.offset, c.offset + c.limit), total: hits.length };
  }
}

export class InMemoryBlockRepository implements BlockRepository {
  private readonly edges = new Set<string>();
  private key = (a: string, b: string) => `${a}>${b}`;

  async add(blocker: string, blocked: string) {
    this.edges.add(this.key(blocker, blocked));
  }
  async remove(blocker: string, blocked: string) {
    this.edges.delete(this.key(blocker, blocked));
  }
  async listBlocked(blocker: string) {
    return [...this.edges].filter((e) => e.startsWith(`${blocker}>`)).map((e) => e.split(">")[1]);
  }
  async countBlockedBy(blocked: string) {
    return [...this.edges].filter((e) => e.endsWith(`>${blocked}`)).length;
  }
  async removeAllInvolving(userId: string) {
    for (const e of [...this.edges]) {
      const [a, b] = e.split(">");
      if (a === userId || b === userId) this.edges.delete(e);
    }
  }
}
