"use client";

import { useState, useTransition } from "react";
import { moveTaskAction } from "@/app/(app)/proyectos/[projectId]/actions";
import type { TaskStatus } from "@/lib/types";
import styles from "./TaskCheck.module.css";

/**
 * Check box of a task or subtask: done <-> to do. If the API refuses the change
 * (e.g. the task still has pending subtasks) the reason shows next to the box.
 */
export function TaskCheck({
  projectId,
  taskId,
  done,
}: {
  projectId: string;
  taskId: string;
  done: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function toggle() {
    const next: TaskStatus = done ? "TODO" : "DONE";
    setError(undefined);
    startTransition(async () => {
      const result = await moveTaskAction(projectId, taskId, next);
      if (result.error) setError(result.error);
    });
  }

  return (
    <span className={styles.wrap}>
      <button
        type="button"
        className={[styles.check, done && styles.on].filter(Boolean).join(" ")}
        aria-label={done ? "Marcar como pendiente" : "Marcar como hecha"}
        aria-pressed={done}
        disabled={pending}
        onClick={toggle}
      >
        {done && "✓"}
      </button>
      {error && (
        <span className={styles.error} role="alert">
          {error}
          <button
            type="button"
            className={styles.dismiss}
            aria-label="Cerrar aviso"
            onClick={() => setError(undefined)}
          >
            ✕
          </button>
        </span>
      )}
    </span>
  );
}
