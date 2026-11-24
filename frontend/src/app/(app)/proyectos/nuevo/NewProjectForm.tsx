"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Input, Textarea } from "@/components/ui";
import { createProjectAction, type ProjectFormState } from "../actions";
import styles from "../projects.module.css";

const initial: ProjectFormState = {};

export function NewProjectForm() {
  const [state, action, pending] = useActionState(createProjectAction, initial);

  return (
    <form action={action} className={styles.form} noValidate>
      <Input
        name="name"
        label="Nombre"
        placeholder="Gestor de entrenamientos"
        maxLength={100}
        defaultValue={state.values?.name}
        error={state.errors?.name}
        autoFocus
      />
      <Textarea
        name="description"
        label="Descripción"
        hint="Opcional"
        placeholder="¿De qué trata el proyecto?"
        maxLength={1000}
        defaultValue={state.values?.description}
        error={state.errors?.description}
      />
      {state.message && (
        <p className={styles.error} role="alert">
          {state.message}
        </p>
      )}
      <div className={styles.formActions}>
        <Link href="/proyectos" className={styles.back} style={{ margin: 0 }}>
          Cancelar
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "Creando…" : "Crear proyecto"}
        </Button>
      </div>
    </form>
  );
}
