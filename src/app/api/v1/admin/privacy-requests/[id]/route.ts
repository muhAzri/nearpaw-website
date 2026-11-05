import { backend } from "@/backend/composition";
import { route } from "@/app/api/v1/_lib/route";

export const GET = route((req, p) => { const b = backend(); return b.support.getPrivacy(req, p.id); });
export const PATCH = route((req, p) => { const b = backend(); return b.support.updatePrivacy(req, p.id); });
