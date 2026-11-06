import { systemClock, type Clock } from "@/backend/shared/application/clock";
import { Housekeeping, type HousekeepingTask } from "./application/housekeeping.usecases";
import { HousekeepingController } from "./presentation/housekeeping.controller";

export function createHousekeepingModule(deps: { secret: () => string | undefined; tasks: readonly HousekeepingTask[]; clock?: Clock }) {
  const job = new Housekeeping(deps.tasks, deps.clock ?? systemClock);
  return { job, controller: new HousekeepingController(deps.secret, job) };
}
