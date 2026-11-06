import { backend } from "@/backend/composition";
import { route } from "@/app/api/v1/_lib/route";

// Deleting many photos from R2 can take a while.
export const maxDuration = 60;

export const GET = route((req) => backend().housekeeping.run(req));
