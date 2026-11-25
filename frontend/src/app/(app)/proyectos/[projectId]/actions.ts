"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { callApi, fieldErrors, formText } from "@/lib/actions";
import { taskSchema } from "@/lib/task-schemas";
import type { ActionResult, LabelView, TaskStatus, TaskView } from "@/lib/types";

export interface TaskFormState {
  errors?: { title?: string; description?: string };
  message?: string;
  /** Echoed back so the form does not lose what was typed. */
  values?: Record<"title" | "description" | "priority" | "dueDate" | "assigneeId", string>;
  /** Labels ticked and typed, echoed back for the same reason. */
  labels?: { ids: string[]; added: string };
}

const LABEL_NAME_MAX = 30;

/**
 * The label ids of a submitted task form, or `undefined` when the form has no
 * label field (subtasks): then the labels are left alone. Ticked labels come
 * as `labelId`; the comma-separated `newLabels` are created first (or matched
 * with an existing one, ignoring case).
 */
async function readLabelIds(
  projectId: string,
  formData: FormData,
): Promise<{ ids?: string[]; error?: string }> {
  if (formData.get("hasLabels") === null) return {};
  const ids = formData.getAll("labelId").filter((v): v is string => typeof v === "string");
  const added = formText(formData, "newLabels")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  if (added.length === 0) return { ids };

  const tooLong = added.find((name) => name.length > LABEL_NAME_MAX);
  if (tooLong) return { error: `La etiqueta «${tooLong}» supera los ${LABEL_NAME_MAX} caracteres` };

  const existing = await callApi<LabelView[]>(`/projects/${projectId}/labels`);
  if (!existing.ok) return { error: existing.message };
  const byName = new Map(existing.data.map((l) => [l.name.toLowerCase(), l.id]));
  for (const name of added) {
    const known = byName.get(name.toLowerCase());
    if (known) {
      ids.push(known);
      continue;
    }
    const created = await callApi<LabelView>(`/projects/${projectId}/labels`, {
      method: "POST",
      body: { name },
    });
    if (!created.ok) return { error: created.message };
    byName.set(name.toLowerCase(), created.data.id);
    ids.push(created.data.id);
  }
  return { ids: [...new Set(ids)] };
}

/** What to echo back when a task form fails, so ticked and typed labels survive. */
function labelsEcho(formData: FormData): TaskFormState["labels"] {
  return {
    ids: formData.getAll("labelId").filter((v): v is string => typeof v === "string"),
    added: formText(formData, "newLabels"),
  };
}

/** Reads the task form, validates it and POSTs it to `path` (a task or a subtask collection). */
async function createFromForm(
  projectId: string,
  path: string,
  formData: FormData,
): Promise<{ state?: TaskFormState; created?: true }> {
  const values = taskInput(formData);
  const labels = labelsEcho(formData);
  const parsed = taskSchema.safeParse(values);
  if (!parsed.success) {
    return {
      state: { errors: fieldErrors(parsed.error, ["title", "description"]), values, labels },
    };
  }
  const labelIds = await readLabelIds(projectId, formData);
  if (labelIds.error) return { state: { message: labelIds.error, values, labels } };

  const { title, description, priority, dueDate, assigneeId } = parsed.data;
  const result = await callApi<TaskView>(path, {
    method: "POST",
    body: {
      title,
      priority,
      // Empty optional fields are left out (omitted = nothing set).
      description: description || undefined,
      dueDate: dueDate || undefined,
      assigneeId: assigneeId || undefined,
      labelIds: labelIds.ids,
    },
  });
  if (!result.ok) return { state: { message: result.message, values, labels } };

  // Tasks assigned to the user feed the sidebar counter, and a subtask under a
  // done parent reopens it: both live in the layout / board.
  revalidatePath("/", "layout");
  return { created: true };
}

export async function createTaskAction(
  projectId: string,
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const outcome = await createFromForm(projectId, `/projects/${projectId}/tasks`, formData);
  if (outcome.state) return outcome.state;
  redirect(`/proyectos/${projectId}`);
}

/** The subtask modal stays on the page: success returns an empty state, which closes it. */
export async function createSubtaskAction(
  projectId: string,
  parentId: string,
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const outcome = await createFromForm(
    projectId,
    `/projects/${projectId}/tasks/${parentId}/subtasks`,
    formData,
  );
  return outcome.state ?? {};
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

/**
 * Drag and drop: drop a card in a column between two others. The server derives
 * the position from the neighbours. Returns `{ error }` if refused (e.g. 409:
 * pending subtasks), and the board puts the card back.
 */
export async function dropTaskAction(
  projectId: string,
  taskId: string,
  status: TaskStatus,
  afterTaskId: string | null,
  beforeTaskId: string | null,
): Promise<ActionResult> {
  // Called from a client component: do not trust the argument's type.
  if (!["TODO", "IN_PROGRESS", "DONE"].includes(status)) {
    return { error: "Estado no válido" };
  }
  const result = await callApi(`/projects/${projectId}/tasks/${taskId}/move`, {
    method: "PATCH",
    body: { status, afterTaskId, beforeTaskId },
  });
  if (!result.ok) return { error: result.message };
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
  const labels = labelsEcho(formData);
  const parsed = taskSchema.safeParse(values);
  if (!parsed.success) {
    return {
      errors: fieldErrors(parsed.error, ["title", "description"]),
      values,
      labels,
    };
  }
  const labelIds = await readLabelIds(projectId, formData);
  if (labelIds.error) return { message: labelIds.error, values, labels };

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
      // Omitted for subtasks (no label field): the API leaves labels alone.
      labelIds: labelIds.ids,
    },
  });
  if (!result.ok) {
    return { message: result.message, values, labels };
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


/** Label management lives on the project's edit page (rename and delete are owner-only in the API). */
export async function createLabelAction(
  projectId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const name = formText(formData, "name").trim();
  if (!name) return { error: "Escribe un nombre" };
  if (name.length > LABEL_NAME_MAX) return { error: `Máximo ${LABEL_NAME_MAX} caracteres` };
  const result = await callApi(`/projects/${projectId}/labels`, { method: "POST", body: { name } });
  if (!result.ok) return { error: result.message };
  revalidatePath("/", "layout");
  return {};
}

export async function renameLabelAction(
  projectId: string,
  labelId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const name = formText(formData, "name").trim();
  if (!name) return { error: "Escribe un nombre" };
  if (name.length > LABEL_NAME_MAX) return { error: `Máximo ${LABEL_NAME_MAX} caracteres` };
  const result = await callApi(`/projects/${projectId}/labels/${labelId}`, {
    method: "PATCH",
    body: { name },
  });
  if (!result.ok) return { error: result.message };
  revalidatePath("/", "layout");
  return {};
}

export async function deleteLabelAction(projectId: string, labelId: string): Promise<ActionResult> {
  const result = await callApi(`/projects/${projectId}/labels/${labelId}`, { method: "DELETE" });
  if (!result.ok) return { error: result.message };
  revalidatePath("/", "layout");
  return {};
}
