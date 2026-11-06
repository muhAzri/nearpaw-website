/**
 * Base error for business-rule violations. Domain & application layers throw
 * these; the presentation layer maps `kind` to an HTTP status.
 */
export type DomainErrorKind =
  | "validation"
  | "not_found"
  | "conflict"
  | "forbidden"
  | "unauthorized"
  | "too_large"
  | "rate_limited"
  | "unavailable";

export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind;
  abstract readonly code: string;

  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  readonly kind = "validation";
  readonly code: string = "VALIDATION_ERROR";
}

export class NotFoundError extends DomainError {
  readonly kind = "not_found";
  readonly code: string = "NOT_FOUND";
}

export class ConflictError extends DomainError {
  readonly kind = "conflict";
  readonly code: string = "CONFLICT";
}

/** A payload or a quota over its limit (HTTP 413). */
export class TooLargeError extends DomainError {
  readonly kind = "too_large";
  readonly code: string = "TOO_LARGE";
}

export class UnauthorizedError extends DomainError {
  readonly kind = "unauthorized";
  readonly code: string = "UNAUTHORIZED";
}

export class ForbiddenError extends DomainError {
  readonly kind = "forbidden";
  readonly code: string = "FORBIDDEN";
}

export class RateLimitedError extends DomainError {
  readonly kind = "rate_limited";
  readonly code: string = "RATE_LIMITED";
}

/** A dependency the feature needs isn't configured or reachable (HTTP 503). */
export class ServiceUnavailableError extends DomainError {
  readonly kind = "unavailable";
  readonly code: string = "SERVICE_UNAVAILABLE";
}
