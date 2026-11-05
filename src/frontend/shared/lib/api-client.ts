import { z } from "zod";
import { API_PREFIX, ApiErrorBodySchema, apiSuccess } from "@/contracts";

/**
 * The frontend talks to the backend ONLY over HTTP using the shared contracts.
 * Server-side calls hit API_BASE_URL directly; browser calls are same-origin (NEXT_PUBLIC_API_BASE_URL empty).
 * and the backend can live anywhere.
 */
function baseUrl(): string {
  if (typeof window === "undefined") {
    return process.env.API_BASE_URL ?? "http://localhost:3000";
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: Omit<RequestInit, "body"> & { body?: unknown },
): Promise<z.infer<S>> {
  const { body, headers, ...rest } = init ?? {};
  const response = await fetch(`${baseUrl()}${API_PREFIX}${path}`, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(body !== undefined && { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = ApiErrorBodySchema.safeParse(json);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiError(response.status, code, message, details);
    }
    throw new ApiError(response.status, "UNKNOWN", response.statusText);
  }

  return schema.parse(json);
}

/** Calls an endpoint that answers `{ data }` and returns just the data. */
export async function apiData<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: Parameters<typeof apiRequest>[2],
): Promise<z.infer<S>> {
  const body = await apiRequest(path, apiSuccess(schema), init);
  return (body as { data: z.infer<S> }).data;
}

/** Calls an endpoint that answers 204 (no body). */
export async function apiVoid(path: string, init?: Parameters<typeof apiRequest>[2]): Promise<void> {
  await apiRequest(path, z.null(), init);
}
