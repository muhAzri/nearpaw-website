import { backend } from "@/backend/composition";
import { route } from "@/app/api/v1/_lib/route";

export const GET = route((req) => { const b = backend(); return b.regions.getConfig(req); });
export const PATCH = route((req) => { const b = backend(); return b.regions.updateConfig(req); });
