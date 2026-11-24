"use server";

import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { loginSchema, registerSchema } from "@/lib/auth-schemas";
import { clearToken, setToken } from "@/lib/session";
import { z } from "zod";

export interface AuthState {
  /** Per-field messages from zod. */
  errors?: { name?: string; email?: string; password?: string };
  /** General message (API error). */
  message?: string;
  /** Echoed back so the form does not lose what was typed. */
  values?: { name?: string; email?: string };
}

interface AuthResponse {
  accessToken: string;
}

function fieldErrors(error: z.ZodError): NonNullable<AuthState["errors"]> {
  const flat = z.flattenError(error).fieldErrors as Record<string, string[]>;
  return {
    name: flat.name?.[0],
    email: flat.email?.[0],
    password: flat.password?.[0],
  };
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function registerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const input = {
    name: text(formData, "name"),
    email: text(formData, "email"),
    password: text(formData, "password"),
  };
  const values = { name: input.name, email: input.email };

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const result = await api<AuthResponse>("/auth/register", {
    method: "POST",
    body: parsed.data,
    auth: false,
  });
  if (!result.ok) return { message: result.message, values };

  await setToken(result.data.accessToken);
  redirect("/proyectos");
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const input = {
    email: text(formData, "email"),
    password: text(formData, "password"),
  };
  const values = { email: input.email };

  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const result = await api<AuthResponse>("/auth/login", {
    method: "POST",
    body: parsed.data,
    auth: false,
  });
  if (!result.ok) return { message: result.message, values };

  await setToken(result.data.accessToken);
  redirect("/proyectos");
}

export async function logoutAction(): Promise<void> {
  await clearToken();
  redirect("/login");
}
