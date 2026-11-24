"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import type { ActionResult } from "@/lib/types";

export interface CommentFormState {
  error?: string;
  /** Echoed back so the field does not lose what was typed. */
  content?: string;
}

function content(formData: FormData): string {
  const value = formData.get("content");
  return typeof value === "string" ? value.trim() : "";
}

function check(text: string): string | undefined {
  if (!text) return "Escribe un comentario";
  if (text.length > 2000) return "Máximo 2000 caracteres";
}

const base = (projectId: string, taskId: string) =>
  `/projects/${projectId}/tasks/${taskId}/comments`;
const page = (projectId: string, taskId: string) =>
  `/proyectos/${projectId}/tareas/${taskId}`;

export async function createCommentAction(
  projectId: string,
  taskId: string,
  _prev: CommentFormState,
  formData: FormData,
): Promise<CommentFormState> {
  const text = content(formData);
  const error = check(text);
  if (error) return { error, content: text };

  const result = await api(base(projectId, taskId), {
    method: "POST",
    body: { content: text },
  });
  if (!result.ok) {
    if (result.status === 401) redirect("/sesion-caducada");
    return { error: result.message, content: text };
  }
  revalidatePath(page(projectId, taskId));
  return {};
}

export async function updateCommentAction(
  projectId: string,
  taskId: string,
  commentId: string,
  raw: string,
): Promise<ActionResult> {
  const text = raw.trim();
  const error = check(text);
  if (error) return { error };

  const result = await api(`${base(projectId, taskId)}/${commentId}`, {
    method: "PATCH",
    body: { content: text },
  });
  if (!result.ok) {
    if (result.status === 401) redirect("/sesion-caducada");
    return { error: result.message };
  }
  revalidatePath(page(projectId, taskId));
  return {};
}

export async function deleteCommentAction(
  projectId: string,
  taskId: string,
  commentId: string,
): Promise<ActionResult> {
  const result = await api(`${base(projectId, taskId)}/${commentId}`, { method: "DELETE" });
  if (!result.ok) {
    if (result.status === 401) redirect("/sesion-caducada");
    return { error: result.message };
  }
  revalidatePath(page(projectId, taskId));  return {};
}
