import { thumbnailKey } from "@/backend/shared/domain/media-key";
import type { UpdateRepository, ReportRepository } from "../domain/repositories";
import type { PhotoEraser } from "./ports";

/** Days a report's photos outlive its expiry (or closing), so owners and moderators can still look at a fresh expiry. */
export const PHOTO_GRACE_DAYS = 3;
const BATCH_SIZE = 100;
/** Bounds one run (and so one serverless invocation); whatever is left is picked up by the next run. */
const MAX_BATCHES = 10;

export type PhotoRetentionResult = { reports: number; updates: number; files: number };

/**
 * Deletes the photo files of reports that are expired, closed or removed, together with the photos of their community
 * updates, and then clears the keys from the records. Files go first: if deleting fails nothing is cleared, and the next
 * run tries again. Deleting is idempotent, so a crash between the two steps is harmless.
 */
export class PhotoRetention {
  constructor(
    private readonly reports: ReportRepository,
    private readonly updates: UpdateRepository,
    private readonly eraser: PhotoEraser,
  ) {}

  async run(now: Date, graceDays = PHOTO_GRACE_DAYS): Promise<PhotoRetentionResult> {
    const cutoff = new Date(now.getTime() - graceDays * 86_400_000);
    const result: PhotoRetentionResult = { reports: 0, updates: 0, files: 0 };

    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      const stale = await this.reports.listWithStalePhotos(cutoff, BATCH_SIZE);
      if (stale.length === 0) break;

      const withUpdates = await Promise.all(
        stale.map(async (report) => ({ report, updates: (await this.updates.listByReport(report.id)).filter((u) => u.photos.length > 0) })),
      );
      const originals = withUpdates.flatMap(({ report, updates }) => [...report.photos, ...updates.flatMap((u) => u.photos)]);
      const keys = [...new Set(originals.flatMap((key) => [key, thumbnailKey(key)]))];

      await this.eraser.deleteObjects(keys);

      for (const { report, updates } of withUpdates) {
        for (const update of updates) await this.updates.save({ ...update, photos: [] });
        await this.reports.save({ ...report, photos: [] });
        result.updates += updates.length;
      }
      result.reports += stale.length;
      result.files += keys.length;
      if (stale.length < BATCH_SIZE) break;
    }
    return result;
  }
}
