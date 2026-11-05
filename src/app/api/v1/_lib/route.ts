import { connection } from "next/server";
import { handle } from "@/backend/shared/presentation/http";

type Params = Record<string, string>;

/**
 * Adapts a framework-agnostic controller call to a Next.js route handler:
 * opts into request-time rendering, resolves params and maps errors to the JSON envelope.
 */
export function route(fn: (request: Request, params: Params) => Promise<Response>) {
  return handle(async (request: Request, ctx?: { params: Promise<Params> }) => {
    await connection();
    return fn(request, (await ctx?.params) ?? {});
  });
}
