"use server";

import { redirect } from "next/navigation";
import { fieldErrors, formText } from "@/lib/actions";
import { api } from "@/lib/api";
import { loginSchema, registerSchema } from "@/lib/auth-schemas";
import { clearToken, setToken } from "@/lib/session";

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

export async function registerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const input = {
    name: formText(formData, "name"),
    email: formText(formData, "email"),
    password: formText(formData, "password"),
  };
  const values = { name: input.name, email: input.email };

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { errors: fieldErrors(parsed.error, ["name", "email", "password"]), values };

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
    email: formText(formData, "email"),
    password: formText(formData, "password"),
  };
  const values = { email: input.email };

  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { errors: fieldErrors(parsed.error, ["name", "email", "password"]), values };

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
