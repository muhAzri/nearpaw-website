import { z } from "zod";

/**
 * Wire format shared by every HTTP endpoint.
 * Any future backend (e.g. Go) MUST produce exactly this envelope so the
 * frontend keeps working unchanged.
 */
export const ApiErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

export const apiSuccess = <T extends z.ZodType>(data: T) =>
  z.object({ data });

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const API_PREFIX = "/api/v1";
