import { backend } from "@/backend/composition";
import { route } from "@/app/api/v1/_lib/route";

export const GET = route((req) => { const b = backend(); return b.identity.me(req); });
export const PATCH = route((req) => { const b = backend(); return b.identity.updateMe(req); });
export const DELETE = route((req) => { const b = backend(); return b.identity.deleteMe(req); });
