"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { api } from "@/lib/api";

export interface AddMemberState {
  error?: string;
  /** Changes on every successful add, so the form can clear itself. */
  added?: number;
  email?: string;
}

const emailSchema = z.email("Escribe un correo válido");

export async function addMemberAction(
  projectId: string,
  _prev: AddMemberState,
  formData: FormData,
): Promise<AddMemberState> {
  const raw = formData.get("email");
  const email = typeof raw === "string" ? raw.trim() : "";

  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const result = await api(`/projects/${projectId}/members`, {
    method: "POST",
    body: { email: parsed.data },
  });
  if (!result.ok) {
    if (result.status === 401) redirect("/sesion-caducada");
    return { error: result.message, email };
  }

  revalidatePath(`/proyectos/${projectId}/miembros`);
  return { added: Date.now() };
}

export async function removeMemberAction(projectId: string, userId: string): Promise<void> {
  const result = await api(`/projects/${projectId}/members/${userId}`, { method: "DELETE" });
  if (!result.ok) {
    if (result.status === 401) redirect("/sesion-caducada");
    throw new Error(result.message);
  }
  revalidatePath(`/proyectos/${projectId}/miembros`);
}
