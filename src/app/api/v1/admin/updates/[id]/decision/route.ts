import { backend } from "@/backend/composition";
import { route } from "@/app/api/v1/_lib/route";

export const POST = route((req, p) => { const b = backend(); return b.moderation.decideUpdate(req, p.id); });
