/** Result returned by server actions to client forms (serializable). */
export type ActionState =
  | null
  | { ok: true; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };
