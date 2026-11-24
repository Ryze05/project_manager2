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
  revalidatePath(`/proyectos/${projectId}`);
  return {};
}
