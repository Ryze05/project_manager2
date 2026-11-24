"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { callApi, fieldErrors, formText } from "@/lib/actions";
import { taskSchema } from "@/lib/task-schemas";
import type { ActionResult, TaskStatus, TaskView } from "@/lib/types";

export interface TaskFormState {
  errors?: { title?: string; description?: string };
  message?: string;
  /** Echoed back so the form does not lose what was typed. */
  values?: Record<"title" | "description" | "priority" | "dueDate" | "assigneeId", string>;
}

export async function createTaskAction(
  projectId: string,
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const values = {
    title: formText(formData, "title"),
    description: formText(formData, "description"),
    priority: formText(formData, "priority") || "MEDIUM",
    dueDate: formText(formData, "dueDate"),
    assigneeId: formText(formData, "assigneeId"),
  };

  const parsed = taskSchema.safeParse(values);
  if (!parsed.success) {
    return {
      errors: fieldErrors(parsed.error, ["title", "description"]),
      values,
    };
  }

  const { title, description, priority, dueDate, assigneeId } = parsed.data;
  const result = await callApi<TaskView>(`/projects/${projectId}/tasks`, {
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
    return { message: result.message, values };
  }

  // Tasks assigned to the user also feed the sidebar counter (in the layout).
  revalidatePath("/", "layout");
  redirect(`/proyectos/${projectId}`);
}

/** Moving a card between columns is a PATCH of `status`. */
export async function moveTaskAction(
  projectId: string,
  taskId: string,
  status: TaskStatus,
): Promise<ActionResult> {
  // Called from client components: do not trust the argument's type.
  if (!["TODO", "IN_PROGRESS", "DONE"].includes(status)) {
    return { error: "Estado no válido" };
  }
  const result = await callApi(`/projects/${projectId}/tasks/${taskId}`, {
    method: "PATCH",
    body: { status },
  });
  if (!result.ok) {
    // E.g. 409: the task still has pending subtasks.
    return { error: result.message };
  }
  // A status shows up on the board, the detail, "mis tareas" and the sidebar counter.
  revalidatePath("/", "layout");
  return {};
}

function taskInput(formData: FormData) {
  return {
    title: formText(formData, "title"),
    description: formText(formData, "description"),
    priority: formText(formData, "priority") || "MEDIUM",
    dueDate: formText(formData, "dueDate"),
    assigneeId: formText(formData, "assigneeId"),
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
    return {
      errors: fieldErrors(parsed.error, ["title", "description"]),
      values,
    };
  }

  const { title, description, priority, dueDate, assigneeId } = parsed.data;
  const result = await callApi<TaskView>(`/projects/${projectId}/tasks/${taskId}`, {
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
    return { message: result.message, values };
  }

  revalidatePath("/", "layout");
  redirect(`/proyectos/${projectId}/tareas/${taskId}`);
}

/** Deletes a task (cascades to its subtasks and comments) or a subtask, then goes back. */
export async function deleteTaskAction(
  projectId: string,
  taskId: string,
  parentId: string | null,
): Promise<ActionResult> {
  const result = await callApi(`/projects/${projectId}/tasks/${taskId}`, { method: "DELETE" });
  if (!result.ok) {
    return { error: result.message };
  }
  revalidatePath("/", "layout");
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
  const title = formText(formData, "title").trim();
  if (!title) return { error: "Escribe un título", title };
  if (title.length > 200) return { error: "Máximo 200 caracteres", title };

  const result = await callApi(`/projects/${projectId}/tasks/${parentId}/subtasks`, {
    method: "POST",
    body: { title },
  });
  if (!result.ok) {
    return { error: result.message, title };
  }
  // Creating a subtask under a done parent reopens it, so refresh the board too.
  revalidatePath("/", "layout");
  return { added: Date.now() };
}
