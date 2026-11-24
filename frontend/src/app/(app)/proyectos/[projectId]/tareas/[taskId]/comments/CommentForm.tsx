"use client";

import { useActionState } from "react";
import { Button, Textarea } from "@/components/ui";
import { createCommentAction, type CommentFormState } from "./actions";
import styles from "./comments.module.css";

export function CommentForm({ projectId, taskId }: { projectId: string; taskId: string }) {
  const [state, action, pending] = useActionState(
    createCommentAction.bind(null, projectId, taskId),
    {} as CommentFormState,
  );

  return (
    <form action={action} className={styles.form} noValidate>
      <Textarea
        name="content"
        rows={2}
        placeholder="Escribe un comentario…"
        aria-label="Nuevo comentario"
        maxLength={2000}
        defaultValue={state.content}
        error={state.error}
        onKeyDown={(event) => {
          // Ctrl/Cmd + Enter sends, plain Enter keeps writing.
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <div className={styles.formActions}>
        <Button type="submit" disabled={pending}>
          {pending ? "Enviando…" : "Comentar"}
        </Button>
      </div>
    </form>
  );
}
