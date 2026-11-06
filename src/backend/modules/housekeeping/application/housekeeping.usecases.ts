import type { Clock } from "@/backend/shared/application/clock";

/** One piece of scheduled cleanup. Other modules supply these through the composition root. */
export interface HousekeepingTask {
  readonly name: string;
  run(now: Date): Promise<Record<string, number>>;
}

export interface TaskOutcome {
  task: string;
  ok: boolean;
  /** Counts from the task, e.g. how many photos were deleted. */
  result?: Record<string, number>;
  /** Short reason; the full error is logged. */
  error?: string;
}

/** Runs every task, one after the other. A failing task never stops the ones after it. */
export class Housekeeping {
  constructor(
    private readonly tasks: readonly HousekeepingTask[],
    private readonly clock: Clock,
  ) {}

  async run(): Promise<TaskOutcome[]> {
    const now = this.clock.now();
    const outcomes: TaskOutcome[] = [];
    for (const task of this.tasks) {
      try {
        outcomes.push({ task: task.name, ok: true, result: await task.run(now) });
      } catch (error) {
        console.error(`[housekeeping] ${task.name} failed`, error);
        outcomes.push({ task: task.name, ok: false, error: error instanceof Error ? error.message : "failed" });
      }
    }
    return outcomes;
  }
}
