import "server-only";
import { notFound, redirect } from "next/navigation";
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

  // Ids reach us from the client (Server Actions) and from the URL. A "../" or an
  // encoded slash would make `fetch` land on a different API route with the user's token.
  if (/(^|\/)\.\.?(\/|$)|\\|%2e|%2f|%5c/i.test(path.split("?")[0])) {
    return { ok: false, status: 400, message: "Ruta no válida" };
  }

  let response: Response;
  let text: string;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    text = await response.text();
  } catch {
    return {
      ok: false,
      status: 0,
      message: "No se pudo conectar con el servidor",
    };
  }

  // A proxy or gateway may answer with HTML or plain text instead of JSON.
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: messageOf(payload, "Ha ocurrido un error"),
    };
  }
  return { ok: true, status: response.status, data: payload as T };
}

/**
 * For Server Components: returns the data or leaves the page. An expired
 * token goes through `/sesion-caducada` (Server Components cannot delete
 * cookies), a 404 shows the not-found page, anything else reaches the error
 * boundary.
 */
export async function unwrap<T>(result: ApiResult<T>): Promise<T> {
  if (result.ok) return result.data;
  if (result.status === 401) redirect("/sesion-caducada");
  if (result.status === 404) notFound();
  throw new Error(result.message);
}
