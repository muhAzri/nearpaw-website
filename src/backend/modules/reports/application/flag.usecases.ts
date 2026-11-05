import type { AuditRecorder } from "@/backend/shared/application/audit";
import type { Clock } from "@/backend/shared/application/clock";
import { ConflictError, NotFoundError, ValidationError } from "@/backend/shared/domain/errors";
import { SYSTEM_ACTOR, type Principal } from "@/backend/shared/domain/principal";
import { publicText } from "@/backend/shared/domain/text";
import { hideUpdate } from "../domain/community-update";
import { shouldAutoHide, type Flag, type FlagReason, type FlagTarget } from "../domain/flag";
import { effectiveState, hide, withOpenFlags } from "../domain/report";
import type { FlagRepository, ReportRepository, UpdateRepository } from "../domain/repositories";
import type { ContributorDirectory, LimitsReader } from "./ports";

interface ResolvedTarget {
  type: FlagTarget;
  id: string;
  ref: string;
  authorId: string;
}

export class FlagService {
  constructor(
    private readonly flags: FlagRepository,
    private readonly reports: ReportRepository,
    private readonly updates: UpdateRepository,
    private readonly contributors: ContributorDirectory,
    private readonly limits: LimitsReader,
    private readonly audit: AuditRecorder,
    private readonly clock: Clock,
  ) {}

  private async resolve(type: FlagTarget, rawId: string): Promise<ResolvedTarget> {
    if (type === "report") {
      const r = await this.reports.findByRef(rawId);
      if (!r || r.state === "removed") throw new NotFoundError("Report not found");
      return { type, id: r.id, ref: r.ref, authorId: r.reporterId };
    }
    if (type === "update") {
      const u = await this.updates.findById(rawId);
      if (!u) throw new NotFoundError("Update not found");
      return { type, id: u.id, ref: u.ref, authorId: u.authorId };
    }
    const userId = await this.contributors.resolveHandle(Number(rawId));
    if (!userId) throw new NotFoundError("User not found");
    return { type, id: userId, ref: await this.contributors.publicLabel(userId), authorId: userId };
  }

  async create(
    flagger: Principal,
    input: { targetType: FlagTarget; targetId: string; reason: FlagReason; details?: string; alsoBlock: boolean },
  ) {
    await this.contributors.assertCanContribute(flagger.id);
    const target = await this.resolve(input.targetType, input.targetId);
    if (target.authorId === flagger.id) throw new ValidationError("You can't flag your own content");
    if (await this.flags.hasFlagged(flagger.id, target.type, target.id)) {
      throw new ConflictError("You've already flagged this");
    }

    const flag: Flag = {
      id: crypto.randomUUID(),
      number: await this.flags.nextNumber(),
      targetType: target.type,
      targetId: target.id,
      targetRef: target.ref,
      flaggerId: flagger.id,
      reason: input.reason,
      details: input.details?.trim() ? publicText(input.details, "Details", { max: 500 }) : null,
      status: "open",
      outcome: null,
      notes: null,
      createdAt: this.clock.now(),
      resolvedAt: null,
    };
    await this.flags.add(flag);
    if (input.alsoBlock) await this.contributors.block(flagger.id, target.authorId);

    const open = await this.flags.openFor(target.type, target.id);
    const count = new Set(open.map((f) => f.flaggerId)).size;
    const { autoHideAfterFlags } = await this.limits.safetyLimits();

    if (target.type === "report") {
      const report = await this.reports.findById(target.id);
      if (report) {
        let next = withOpenFlags(report, count);
        if (effectiveState(report, this.clock.now()) === "live" && shouldAutoHide(count, autoHideAfterFlags)) {
          next = hide(next, "auto", `${count} flags`);
          await this.audit.record({ actor: SYSTEM_ACTOR, action: "report.auto_hide", target: report.ref, reason: `${count} flags` });
        }
        await this.reports.save(next);
      }
    } else if (target.type === "update") {
      const update = await this.updates.findById(target.id);
      if (update) {
        let next = withOpenFlags(update, count);
        if (update.state === "live" && shouldAutoHide(count, autoHideAfterFlags)) {
          next = hideUpdate(next, "auto");
          await this.audit.record({ actor: SYSTEM_ACTOR, action: "update.auto_hide", target: update.ref, reason: `${count} flags` });
        }
        await this.updates.save(next);
      }
    }
    return { received: true as const };
  }
}
