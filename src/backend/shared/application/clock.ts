export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;
