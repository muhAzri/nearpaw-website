export type Role = "user" | "admin";

/** The authenticated caller. Admin ids are opaque (never an email). */
export interface Principal {
  readonly id: string;
  readonly role: Role;
}

/** Who performed an audited action. */
export interface Actor {
  readonly kind: "admin" | "system";
  readonly id: string;
}

export const SYSTEM_ACTOR: Actor = { kind: "system", id: "system" };

export const actorOf = (principal: Principal): Actor => ({ kind: "admin", id: principal.id });
