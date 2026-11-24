"use client";

import { useActionState, useEffect, useRef } from "react";
import { createSubtaskAction, type SubtaskFormState } from "../../actions";
import styles from "./task.module.css";

/** Last row of the subtask list: type a title and press Enter, no button. */
export function AddSubtaskForm({ projectId, parentId }: { projectId: string; parentId: string }) {
  const [state, action] = useActionState(
    createSubtaskAction.bind(null, projectId, parentId),
    {} as SubtaskFormState,
  );
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);

  // After a successful add: empty the field and keep the focus to add the next one.
  useEffect(() => {
    if (!state.added) return;
    form.current?.reset();
    input.current?.focus();
  }, [state.added]);

  return (
    <form ref={form} action={action} className={styles.addRow} noValidate>
      <div className={styles.addLine}>
        <span className={styles.plus} aria-hidden="true">
          +
        </span>
        <input
          ref={input}
          name="title"
          className={styles.addInput}
          placeholder="Añadir una subtarea…"
          aria-label="Título de la nueva subtarea"
          aria-invalid={state.error ? true : undefined}
          maxLength={200}
          autoComplete="off"
          enterKeyHint="done"
          defaultValue={state.title}
        />
      </div>
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
