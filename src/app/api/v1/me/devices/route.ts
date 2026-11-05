import { backend } from "@/backend/composition";
import { route } from "@/app/api/v1/_lib/route";

export const POST = route((req) => { const b = backend(); return b.alerts.registerDevice(req); });
export const DELETE = route((req) => { const b = backend(); return b.alerts.unregisterDevice(req); });
