import { z } from "zod";
import { apiData } from "@/frontend/shared/lib/api-client";

const ConfigSchema = z.object({
  featureFlags: z.object({ restrictToRegions: z.boolean() }),
  regions: z.array(z.object({ name: z.string() })),
});

export interface Coverage {
  /** true = reporting is limited to active regions. */
  restricted: boolean;
  regions: string[];
}

/** Where Nearpaw is active. Returns null when the backend can't be reached so the page keeps its generic copy. */
export async function getCoverage(): Promise<Coverage | null> {
  try {
    const config = await apiData("/config", ConfigSchema);
    return { restricted: config.featureFlags.restrictToRegions, regions: config.regions.map((r) => r.name) };
  } catch {
    return null;
  }
}
