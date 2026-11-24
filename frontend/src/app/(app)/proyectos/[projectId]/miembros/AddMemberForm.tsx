"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { addMemberAction, type AddMemberState } from "./actions";
import styles from "../../projects.module.css";

export function AddMemberForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(
    addMemberAction.bind(null, projectId),
    {} as AddMemberState,
  );

  return (
    // `key` remounts the form after a successful add, which empties the field.
    <form action={action} className={styles.inline} noValidate key={state.added ?? "new"}>
      <div className={styles.grow}>
        <Input
          name="email"
          type="email"
          placeholder="correo@ejemplo.com"
          aria-label="Correo del nuevo miembro"
          defaultValue={state.email}
          error={state.error}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Añadiendo…" : "Añadir"}
      </Button>
    </form>
  );
}
