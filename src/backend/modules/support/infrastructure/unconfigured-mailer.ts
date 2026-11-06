import type { Mailer } from "../application/support.usecases";

/** Until a mail provider is configured, replies are stored but reported as not delivered. */
export class UnconfiguredMailer implements Mailer {
  async send() {
    return false;
  }
}
