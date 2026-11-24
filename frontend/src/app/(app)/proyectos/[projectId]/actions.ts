"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { api } from "@/lib/api";
import { taskSchema } from "@/lib/task-schemas";
import type { TaskStatus, TaskView } from "@/lib/types";

export interface TaskFormState {
  errors?: { title?: string; description?: string };
  message?: string;
  /** Echoed back so the form does not lose what was typed. */
  values?: Record<"title" | "description" | "priority" | "dueDate" | "assigneeId", string>;
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function createTaskAction(
  projectId: string,
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const values = {
    title: text(formData, "title"),
    description: text(formData, "description"),
    priority: text(formData, "priority") || "MEDIUM",
    dueDate: text(formData, "dueDate"),
    assigneeId: text(formData, "assigneeId"),
  };

  const parsed = taskSchema.safeParse(values);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error).fieldErrors as Record<string, string[]>;
    return {
      errors: { title: flat.title?.[0], description: flat.description?.[0] },
      values,
    };
  }

  const { title, description, priority, dueDate, assigneeId } = parsed.data;
  const result = await api<TaskView>(`/projects/${projectId}/tasks`, {
    method: "POST",
    body: {
      title,
      priority,
      // Empty optional fields are left out (omitted = nothing set).
      description: description || undefined,
      dueDate: dueDate || undefined,
      assigneeId: assigneeId || undefined,
    },
  });
  if (!result.ok) {
    if (result.status === 401) redirect("/sesion-caducada");
    return { message: result.message, values };
  }

  revalidatePath(`/proyectos/${projectId}`);
  redirect(`/proyectos/${projectId}`);
}

/** Moving a card between columns is a PATCH of `status`. */
export async function moveTaskAction(
  projectId: string,
  taskId: string,
  status: TaskStatus,
): Promise<{ error?: string }> {
  const result = await api(`/projects/${projectId}/tasks/${taskId}`, {
    method: "PATCH",
    body: { status },
  });
  if (!result.ok) {
    if (result.status === 401) redirect("/sesion-caducada");
    // E.g. 409: the task still has pending subtasks.
    return { error: result.message };
  }
  // A status shows up on the board, the detail, "mis tareas" and the sidebar counter.
  revalidatePath("/", "layout");
  return {};
}

function taskInput(formData: FormData) {
  return {
    title: text(formData, "title"),
    description: text(formData, "description"),
    priority: text(formData, "priority") || "MEDIUM",
    dueDate: text(formData, "dueDate"),
    assigneeId: text(formData, "assigneeId"),
  };
}

export async function updateTaskAction(
  projectId: string,
  taskId: string,
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const values = taskInput(formData);
  const parsed = taskSchema.safeParse(values);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error).fieldErrors as Record<string, string[]>;
    return {
      errors: { title: flat.title?.[0], description: flat.description?.[0] },
      values,
    };
  }

  const { title, description, priority, dueDate, assigneeId } = parsed.data;
  const result = await api<TaskView>(`/projects/${projectId}/tasks/${taskId}`, {
    method: "PATCH",
    body: {
      title,
      priority,
      // `null` clears a field; omitting it would keep the old value.
      description: description || null,
      dueDate: dueDate || null,
      assigneeId: assigneeId || null,
    },
  });
  if (!result.ok) {
    if (result.status === 401) redirect("/sesion-caducada");
    return { message: result.message, values };
  }

  revalidatePath(`/proyectos/${projectId}`, "layout");
  redirect(`/proyectos/${projectId}/tareas/${taskId}`);
}

/** Deletes a task (cascades to its subtasks and comments) or a subtask, then goes back. */
export async function deleteTaskAction(
  projectId: string,
  taskId: string,
  parentId: string | null,
): Promise<void> {
  const result = await api(`/projects/${projectId}/tasks/${taskId}`, { method: "DELETE" });
  if (!result.ok) {
    if (result.status === 401) redirect("/sesion-caducada");
    throw new Error(result.message);
  }
  revalidatePath(`/proyectos/${projectId}`, "layout");
  redirect(parentId ? `/proyectos/${projectId}/tareas/${parentId}` : `/proyectos/${projectId}`);
}

export interface SubtaskFormState {
  error?: string;
  title?: string;
  /** Changes on every successful add, so the form can clear itself. */
  added?: number;
}

export async function createSubtaskAction(
  projectId: string,
  parentId: string,
  _prev: SubtaskFormState,
  formData: FormData,
): Promise<SubtaskFormState> {
  const title = text(formData, "title").trim();
  if (!title) return { error: "Escribe un título", title };
  if (title.length > 200) return { error: "Máximo 200 caracteres", title };

  const result = await api(`/projects/${projectId}/tasks/${parentId}/subtasks`, {
    method: "POST",
    body: { title },
  });
  if (!result.ok) {
    if (result.status === 401) redirect("/sesion-caducada");
    return { error: result.message, title };
  }
  // Creating a subtask under a done parent reopens it, so refresh the board too.
  revalidatePath(`/proyectos/${projectId}`, "layout");
  return { added: Date.now() };
}
