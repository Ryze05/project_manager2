"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { inviteMemberAction, type InviteState } from "./actions";
import styles from "../../projects.module.css";

export function InviteForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(
    inviteMemberAction.bind(null, projectId),
    {} as InviteState,
  );

  return (
    <>
      {/* `key` remounts the form after a successful invitation, which empties the field. */}
      <form action={action} className={styles.inline} noValidate key={state.sent ?? "new"}>
        <div className={styles.grow}>
          <Input
            name="email"
            type="email"
            placeholder="correo@ejemplo.com"
            aria-label="Correo de la persona a invitar"
            defaultValue={state.email}
            error={state.error}
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Invitando…" : "Invitar"}
        </Button>
      </form>
      {state.sent && !state.error && (
        <p className={styles.small} role="status">
          Invitación enviada: aparecerá en la bandeja de esa persona.
        </p>
      )}
    </>
  );
}
