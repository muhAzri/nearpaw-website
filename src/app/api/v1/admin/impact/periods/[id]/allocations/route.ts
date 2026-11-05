import { backend } from "@/backend/composition";
import { route } from "@/app/api/v1/_lib/route";

export const GET = route((req, p) => { const b = backend(); return b.impact.listAllocations(req, p.id); });
export const POST = route((req, p) => { const b = backend(); return b.impact.createAllocation(req, p.id); });
