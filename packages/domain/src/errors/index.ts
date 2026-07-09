import { z } from "zod";

export const DomainErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "NOT_FOUND",
  "RATE_LIMITED",
  "UPSTREAM_UNAVAILABLE",
  "INTERNAL_ERROR",
]);

export const DomainErrorSchema = z.object({
  code: DomainErrorCodeSchema,
  message: z.string().min(1),
  details: z.record(z.unknown()).optional(),
});

export type DomainErrorCode = z.infer<typeof DomainErrorCodeSchema>;
export type DomainError = z.infer<typeof DomainErrorSchema>;
