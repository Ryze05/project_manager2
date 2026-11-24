import "server-only";
import { redirect } from "next/navigation";
import { flattenError, type z } from "zod";
import { api, type ApiResult } from "./api";

/** Value of a text field of a submitted form ("" when missing). */
export function formText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** First zod message of each of the given fields. */
export function fieldErrors<K extends string>(
  error: z.ZodError,
  keys: readonly K[],
): Partial<Record<K, string>> {
  const flat = flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  return Object.fromEntries(
    keys.map((key) => [key, flat[key]?.[0]]),
  ) as Partial<Record<K, string>>;
}

interface CallOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

/**
 * `api()` for Server Actions: an expired or rejected token (401) sends the user
 * to the login, so no action has to remember to check for it.
 */
export async function callApi<T = unknown>(
  path: string,
  options?: CallOptions,
): Promise<ApiResult<T>> {
  const result = await api<T>(path, options);
  if (!result.ok && result.status === 401) redirect("/sesion-caducada");
  return result;
}
