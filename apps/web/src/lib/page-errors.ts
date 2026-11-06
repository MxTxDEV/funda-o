import "server-only";
import { toAppError } from "@vc/core";
import { notFound } from "next/navigation";

/** Maps "not found" / malformed ids to the 404 page; other errors go to the error boundary. */
export function handlePageError(err: unknown): never {
  const e = toAppError(err);
  if (e && (e.code === "NOT_FOUND" || e.code === "VALIDATION")) notFound();
  throw err;
}
