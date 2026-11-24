"use client";

import { useActionState, useState } from "react";
import { ConfirmDelete } from "@/components/ConfirmDelete/ConfirmDelete";
import { Avatar, Button, Textarea } from "@/components/ui";
import type { CommentView } from "@/lib/types";
import {
  deleteCommentAction,
  updateCommentAction,
  type CommentFormState,
} from "./actions";
import styles from "./comments.module.css";

type Props = {
  projectId: string;
  taskId: string;
  comment: CommentView;
  /** Preformatted on the server ("hace 2 h"), so server and browser agree. */
  when: string;
  isMine: boolean;
  /** Author or project owner. */
  canDelete: boolean;
};

/** One comment: edit it in place (author only) or delete it (author or owner). */
export function CommentItem({ projectId, taskId, comment, when, isMine, canDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(
    async (prev: CommentFormState, formData: FormData) => {
      const result = await updateCommentAction(projectId, taskId, comment.id, prev, formData);
      if (!result.error) setEditing(false);
      return result;
    },
    {} as CommentFormState,
  );

  return (
    <li className={styles.comment}>
      <Avatar name={comment.author.name} me={isMine} />
      <div className={styles.bubble}>
        <div className={styles.meta}>
          <b>{comment.author.name}</b>
          <span>
            {when}
            {comment.editedAt && " · editado"}
          </span>
        </div>

        {editing ? (
          <form action={action} className={styles.form} noValidate>
            <Textarea
              name="content"
              rows={2}
              aria-label="Editar comentario"
              maxLength={2000}
              defaultValue={state.content ?? comment.content}
              error={state.error}
              autoFocus
            />
            <div className={styles.formActions}>
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </form>
        ) : (
          <p className={styles.content}>{comment.content}</p>
        )}

        {!editing && (isMine || canDelete) && (
          <div className={styles.tools}>
            {isMine && (
              <Button variant="link" onClick={() => setEditing(true)}>
                Editar
              </Button>
            )}
            {canDelete && (
              <ConfirmDelete
                action={deleteCommentAction.bind(null, projectId, taskId, comment.id)}
                label="Eliminar"
                title="¿Eliminar este comentario?"
                description="No se puede deshacer."
              />
            )}
          </div>
        )}
      </div>
    </li>
  );
}
