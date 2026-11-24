"use client";

import { useState, useTransition } from "react";
import { ConfirmDelete } from "@/components/ConfirmDelete/ConfirmDelete";
import { Avatar, Button, Textarea } from "@/components/ui";
import type { CommentView } from "@/lib/types";
import { deleteCommentAction, updateCommentAction } from "./actions";
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
          // Mounted only while editing, so a cancelled or failed edit leaves nothing behind.
          <EditForm
            projectId={projectId}
            taskId={taskId}
            comment={comment}
            onDone={() => setEditing(false)}
          />
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
                action={() => deleteCommentAction(projectId, taskId, comment.id)}
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

function EditForm({
  projectId,
  taskId,
  comment,
  onDone,
}: {
  projectId: string;
  taskId: string;
  comment: CommentView;
  onDone: () => void;
}) {
  const [text, setText] = useState(comment.content);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await updateCommentAction(projectId, taskId, comment.id, text);
      if (result.error) setError(result.error);
      else onDone();
    });
  }

  return (
    <form onSubmit={save} className={styles.form} noValidate>
      <Textarea
        rows={2}
        aria-label="Editar comentario"
        maxLength={2000}
        value={text}
        onChange={(event) => setText(event.target.value)}
        error={error}
        autoFocus
      />
      <div className={styles.formActions}>
        <Button variant="ghost" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
