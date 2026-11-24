"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Input, Textarea } from "@/components/ui";
import type { ProjectFormState } from "./actions";
import styles from "./projects.module.css";

type Props = {
  action: (state: ProjectFormState, formData: FormData) => Promise<ProjectFormState>;
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
  /** Current values when editing. */
  initial?: { name: string; description: string };
};

/** Name + description form shared by "new project" and "edit project". */
export function ProjectForm({ action, submitLabel, pendingLabel, cancelHref, initial }: Props) {
  const [state, formAction, pending] = useActionState(action, {} as ProjectFormState);
  const values = state.values ?? initial;

  return (
    <form action={formAction} className={styles.form} noValidate>
      <Input
        name="name"
        label="Nombre"
        placeholder="Gestor de entrenamientos"
        maxLength={100}
        defaultValue={values?.name}
        error={state.errors?.name}
        autoFocus
      />
      <Textarea
        name="description"
        label="Descripción"
        hint="Opcional"
        placeholder="¿De qué trata el proyecto?"
        maxLength={1000}
        defaultValue={values?.description}
        error={state.errors?.description}
      />
      {state.message && (
        <p className={styles.error} role="alert">
          {state.message}
        </p>
      )}
      <div className={styles.formActions}>
        <Link href={cancelHref} className={styles.cancel}>
          Cancelar
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
