"use server";

import { redirect } from "next/navigation";
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

export async function createProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const values = {
    name: text(formData, "name"),
    description: text(formData, "description"),
  };

  const parsed = projectSchema.safeParse(values);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error).fieldErrors as Record<string, string[]>;
    return {
      errors: { name: flat.name?.[0], description: flat.description?.[0] },
      values,
    };
  }

  const result = await api<ProjectView>("/projects", {
    method: "POST",
    body: {
      name: parsed.data.name,
      // An empty description is "no description", not an empty string.
      description: parsed.data.description || undefined,
    },
  });
  if (!result.ok) {
    if (result.status === 401) redirect("/sesion-caducada");
    return { message: result.message, values };
  }

  redirect(`/proyectos/${result.data.id}`);
}
