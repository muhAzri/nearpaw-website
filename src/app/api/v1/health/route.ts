import { ok } from "@/backend/shared/presentation/http";

export function GET() {
  return ok({ status: "ok" });
}
