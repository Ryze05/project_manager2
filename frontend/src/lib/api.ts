import "server-only";
import { getToken } from "./session";

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; message: string };

interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Send the session token (default). Only login and register turn it off. */
  auth?: boolean;
}

function baseUrl(): string {
  const url = process.env.API_URL;
  if (!url) {
    throw new Error("API_URL is not set (see .env.example)");
  }
  return url.replace(/\/$/, "");
}

/** The API answers `message` as a string, or as an array for validation errors. */
function messageOf(payload: unknown, fallback: string): string {
  const message = (payload as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return message.join(". ");
  return typeof message === "string" ? message : fallback;
}

/**
 * The only door to the NestJS API. Server-side only: the browser never talks
 * to the API, so the token never leaves the server. Never throws for HTTP or
 * network errors: callers get `{ ok: false, status, message }` (status 0 when
 * the API cannot be reached).
 */
export async function api<T = unknown>(
  path: string,
  { method = "GET", body, auth = true }: ApiOptions = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      status: 0,
      message: "No se pudo conectar con el servidor",
    };
  }

  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : null;
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: messageOf(payload, "Ha ocurrido un error"),
    };
  }
  return { ok: true, status: response.status, data: payload as T };
}
