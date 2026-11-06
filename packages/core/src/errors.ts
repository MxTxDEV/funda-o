import { ZodError } from "zod";

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_STATE"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "UNAVAILABLE";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_STATE: 409,
  VALIDATION: 422,
  RATE_LIMITED: 429,
  UNAVAILABLE: 503,
};

/** Expected, user-facing error. Its message is safe to show to clients. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}

export const notFound = (entity: string) => new AppError("NOT_FOUND", `${entity} não encontrado(a).`);
export const forbidden = (message = "Você não tem permissão para esta operação.") =>
  new AppError("FORBIDDEN", message);
export const conflict = (message: string, details?: unknown) => new AppError("CONFLICT", message, details);
export const invalidState = (message: string, details?: unknown) =>
  new AppError("INVALID_STATE", message, details);

export function fromZodError(err: ZodError) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return new AppError("VALIDATION", "Dados inválidos.", { fieldErrors });
}

/** Normalizes any thrown value into an AppError or null (unexpected error). */
export function toAppError(err: unknown): AppError | null {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) return fromZodError(err);
  return null;
}
