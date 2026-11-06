import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

export function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return dateTime.format(typeof d === "string" ? new Date(d) : d);
}

export function formatRelative(d: Date | string | null | undefined, now = Date.now()) {
  if (!d) return "—";
  const diff = (new Date(d).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return relative.format(Math.round(diff), "second");
  if (abs < 3600) return relative.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return relative.format(Math.round(diff / 3600), "hour");
  return relative.format(Math.round(diff / 86400), "day");
}

/** Converts FormData into a plain object; repeated keys become arrays. */
export function formToObject(form: FormData, arrayKeys: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(form.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const values = form.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = arrayKeys.includes(key) ? values : values[0];
  }
  for (const key of arrayKeys) out[key] ??= [];
  return out;
}
