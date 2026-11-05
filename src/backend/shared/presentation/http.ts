import { z } from "zod";
import type { ApiErrorBody } from "@/contracts";
import { DomainError, TooLargeError, type DomainErrorKind } from "@/backend/shared/domain/errors";

/**
 * Framework-agnostic HTTP helpers built on the Web Request/Response API.
 * Controllers depend on these, not on Next.js, so they map 1:1 to Go handlers.
 */

const STATUS_BY_KIND: Record<DomainErrorKind, number> = {
  validation: 422,
  not_found: 404,
  conflict: 409,
  forbidden: 403,
  unauthorized: 401,
  too_large: 413,
};

export const ok = <T>(data: T, status = 200) =>
  Response.json({ data }, { status });

export const created = <T>(data: T) => ok(data, 201);

export const errorResponse = (
  status: number,
  code: string,
  message: string,
  details?: unknown,
) =>
  Response.json({ error: { code, message, details } } satisfies ApiErrorBody, {
    status,
  });

export function toErrorResponse(error: unknown): Response {
  if (error instanceof DomainError) {
    return errorResponse(
      STATUS_BY_KIND[error.kind],
      error.code,
      error.message,
      error.details,
    );
  }
  if (error instanceof z.ZodError) {
    return errorResponse(422, "VALIDATION_ERROR", "Invalid request", z.flattenError(error));
  }
  if (error instanceof SyntaxError) {
    return errorResponse(400, "BAD_REQUEST", "Malformed JSON body");
  }
  console.error("[backend] unhandled error", error);
  return errorResponse(500, "INTERNAL_ERROR", "Internal server error");
}

/** Wraps a handler so thrown errors become consistent JSON error responses. */
export function handle<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export async function parseJson<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  return schema.parse(await request.json());
}

class PayloadTooLargeError extends TooLargeError {
  override readonly code = "PAYLOAD_TOO_LARGE";
}

/** The request body as bytes; stops reading and fails once it passes `maxBytes`. */
export async function readBytes(request: Request, maxBytes: number): Promise<Uint8Array> {
  const tooLarge = () => new PayloadTooLargeError(`The upload is over the ${Math.round(maxBytes / (1024 * 1024))} MB limit.`);
  if (Number(request.headers.get("content-length")) > maxBytes) throw tooLarge();
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

export function parseQuery<S extends z.ZodType>(
  request: Request,
  schema: S,
): z.infer<S> {
  return schema.parse(Object.fromEntries(new URL(request.url).searchParams));
}
