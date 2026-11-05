import { backend } from "@/backend/composition";
import { route } from "@/app/api/v1/_lib/route";

export const PATCH = route((req, p) => { const b = backend(); return b.impact.updatePeriod(req, p.id); });
