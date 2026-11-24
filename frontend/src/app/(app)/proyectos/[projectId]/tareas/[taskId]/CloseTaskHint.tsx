"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { moveTaskAction } from "../../actions";
import styles from "./task.module.css";

/**
 * Shown when every subtask is done but the task is not. The parent is never
 * completed by itself (closing it is the responsible's decision), so this is
 * only a nudge with the button at hand.
 */
export function CloseTaskHint({ projectId, taskId }: { projectId: string; taskId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function close() {
    setError(undefined);
    startTransition(async () => {
      const result = await moveTaskAction(projectId, taskId, "DONE");
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className={styles.hint}>
      <span>Todas las subtareas están completadas.</span>
      <Button onClick={close} disabled={pending}>
        {pending ? "Cerrando…" : "Marcar la tarea como hecha"}
      </Button>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
