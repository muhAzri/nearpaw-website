import { backend } from "@/backend/composition";
import { route } from "@/app/api/v1/_lib/route";

export const GET = route((req, p) => { const b = backend(); return b.reports.myDetail(req, p.ref); });
export const PATCH = route((req, p) => { const b = backend(); return b.reports.edit(req, p.ref); });
