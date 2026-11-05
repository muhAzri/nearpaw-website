import { backend } from "@/backend/composition";
import { route } from "@/app/api/v1/_lib/route";

export const DELETE = route((req, p) => { const b = backend(); return b.identity.unblock(req, p.handle); });
