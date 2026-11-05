import { backend } from "@/backend/composition";
import { route } from "@/app/api/v1/_lib/route";

export const GET = route((req) => { const b = backend(); return b.reports.list(req); });
export const POST = route((req) => { const b = backend(); return b.reports.create(req); });
