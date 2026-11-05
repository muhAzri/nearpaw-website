import { z } from "zod";

export const AuditQuerySchema = z.object({
  actor: z.enum(["admin", "system"]).optional(),
  action: z.string().trim().max(60).optional(),
  target: z.string().trim().max(60).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
