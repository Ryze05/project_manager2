"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { callApi, fieldErrors, formText } from "@/lib/actions";
import { projectSchema } from "@/lib/project-schemas";
import type { ActionResult, ProjectView } from "@/lib/types";

export interface ProjectFormState {
  errors?: { name?: string; description?: string };
  message?: string;
  /** Echoed back so the form does not lose what was typed. */
  values?: { name?: string; description?: string };
}

/** Reads and validates the shared form; returns the state to show if it fails. */
function readForm(formData: FormData) {
  const values = {
    name: formText(formData, "name"),
    description: formText(formData, "description"),
  };
  const parsed = projectSchema.safeParse(values);
  if (parsed.success) return { data: parsed.data, values };
  return {
    failure: {
      errors: fieldErrors(parsed.error, ["name", "description"]),
      values,
    } satisfies ProjectFormState,
  };
}

export async function createProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const form = readForm(formData);
  if (form.failure) return form.failure;

  const result = await callApi<ProjectView>("/projects", {
    method: "POST",
    body: {
      name: form.data.name,
      // An empty description is "no description", not an empty string.
      description: form.data.description || undefined,
    },
  });
  if (!result.ok) {
    return { message: result.message, values: form.values };
  }

  // The new project must show up in the sidebar (it lives in the layout).
  revalidatePath("/", "layout");
  redirect(`/proyectos/${result.data.id}`);
}

export async function updateProjectAction(
  projectId: string,
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const form = readForm(formData);
  if (form.failure) return form.failure;

  const result = await callApi<ProjectView>(`/projects/${projectId}`, {
    method: "PATCH",
    // `null` clears the description (the API accepts it; omitted would keep it).
    body: { name: form.data.name, description: form.data.description || null },
  });
  if (!result.ok) {
    return { message: result.message, values: form.values };
  }

  // The sidebar (recent projects) lives in the layout.
  revalidatePath("/", "layout");
  redirect(`/proyectos/${projectId}`);
}

export async function deleteProjectAction(projectId: string): Promise<ActionResult> {
  const result = await callApi(`/projects/${projectId}`, { method: "DELETE" });
  if (!result.ok) {
    return { error: result.message };
  }
  revalidatePath("/", "layout");
  redirect("/proyectos");
}
