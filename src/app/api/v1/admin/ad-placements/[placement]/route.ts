import { backend } from "@/backend/composition";
import { route } from "@/app/api/v1/_lib/route";

export const PUT = route((req, p) => { const b = backend(); return b.regions.setPlacement(req, p.placement); });
