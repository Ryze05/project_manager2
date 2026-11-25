"use client";

import { useActionState } from "react";
import { ConfirmDelete } from "@/components/ConfirmDelete/ConfirmDelete";
import { Button, Input } from "@/components/ui";
import type { ActionResult, LabelView } from "@/lib/types";
import {
  createLabelAction,
  deleteLabelAction,
  renameLabelAction,
} from "../actions";
import styles from "../../projects.module.css";

/** One row: rename in place, or delete (which only takes the label off its tasks). */
function LabelRow({ projectId, label }: { projectId: string; label: LabelView }) {
  const [state, action, pending] = useActionState(
    renameLabelAction.bind(null, projectId, label.id),
    {} as ActionResult,
  );
  return (
    <li>
      <form action={action} className={styles.listBody}>
        <div className={styles.inline}>
          <div className={styles.grow}>
            <Input
              name="name"
              aria-label={`Nombre de la etiqueta ${label.name}`}
              defaultValue={label.name}
              maxLength={30}
              error={state.error}
            />
          </div>
          <Button type="submit" variant="ghost" disabled={pending}>
            {pending ? "Guardando…" : "Renombrar"}
          </Button>
        </div>
        <span className={styles.listMeta}>
          {label.taskCount === 1 ? "1 tarea" : `${label.taskCount} tareas`}
        </span>
      </form>
      <ConfirmDelete
        action={deleteLabelAction.bind(null, projectId, label.id)}
        label="Eliminar"
        title={`¿Eliminar la etiqueta «${label.name}»?`}
        description="Se quitará de sus tareas, que no se borran."
      />
    </li>
  );
}

/** Label management on the project's edit page (owner only). Members create labels from the task form. */
export function LabelManager({ projectId, labels }: { projectId: string; labels: LabelView[] }) {
  const [state, action, pending] = useActionState(
    createLabelAction.bind(null, projectId),
    {} as ActionResult,
  );
  return (
    <>
      {labels.length === 0 ? (
        <p className={styles.small}>Todavía no hay etiquetas.</p>
      ) : (
        <ul className={styles.list}>
          {labels.map((label) => (
            <LabelRow key={`${label.id}:${label.name}`} projectId={projectId} label={label} />
          ))}
        </ul>
      )}
      <form action={action} className={styles.inline}>
        <div className={styles.grow}>
          <Input
            name="name"
            aria-label="Nueva etiqueta"
            placeholder="Nueva etiqueta"
            maxLength={30}
            error={state.error}
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Añadiendo…" : "Añadir"}
        </Button>
      </form>
    </>
  );
}
