"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { api } from "@/lib/api";
import { projectSchema } from "@/lib/project-schemas";
import type { ProjectView } from "@/lib/types";

export interface ProjectFormState {
  errors?: { name?: string; description?: string };
  message?: string;
  /** Echoed back so the form does not lose what was typed. */
  values?: { name?: string; description?: string };
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Reads and validates the shared form; returns the state to show if it fails. */
function readForm(formData: FormData) {
  const values = {
    name: text(formData, "name"),
    description: text(formData, "description"),
  };
  const parsed = projectSchema.safeParse(values);
  if (parsed.success) return { data: parsed.data, values };
  const flat = z.flattenError(parsed.error).fieldErrors as Record<string, string[]>;
  return {
    failure: {
      errors: { name: flat.name?.[0], description: flat.description?.[0] },
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

  const result = await api<ProjectView>("/projects", {
    method: "POST",
    body: {
      name: form.data.name,
      // An empty description is "no description", not an empty string.
      description: form.data.description || undefined,
    },
  });
  if (!result.ok) {
    if (result.status === 401) redirect("/sesion-caducada");
    return { message: result.message, values: form.values };
  }

  redirect(`/proyectos/${result.data.id}`);
}

export async function updateProjectAction(
  projectId: string,
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const form = readForm(formData);
  if (form.failure) return form.failure;

  const result = await api<ProjectView>(`/projects/${projectId}`, {
    method: "PATCH",
    // `null` clears the description (the API accepts it; omitted would keep it).
    body: { name: form.data.name, description: form.data.description || null },
  });
  if (!result.ok) {
    if (result.status === 401) redirect("/sesion-caducada");
    return { message: result.message, values: form.values };
  }

  // The sidebar (recent projects) lives in the layout.
  revalidatePath("/", "layout");
  redirect(`/proyectos/${projectId}`);
}

export async function deleteProjectAction(projectId: string): Promise<void> {
  const result = await api(`/projects/${projectId}`, { method: "DELETE" });
  if (!result.ok) {
    if (result.status === 401) redirect("/sesion-caducada");
    throw new Error(result.message);
  }
  revalidatePath("/", "layout");
  redirect("/proyectos");
}
