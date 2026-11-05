import { buildOpenApi } from "@/contracts/openapi";
import { route } from "@/app/api/v1/_lib/route";

export const GET = route(async (req) => Response.json(buildOpenApi(new URL(req.url).origin)));
