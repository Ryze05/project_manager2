"use client";

import { useState, useTransition } from "react";
import type { TaskStatus } from "@/lib/types";
import { moveTaskAction } from "../../actions";
import styles from "./task.module.css";

const OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "TODO", label: "Por hacer" },
  { value: "IN_PROGRESS", label: "En curso" },
  { value: "DONE", label: "Hecha" },
];

/** Status of the task as a select; shows the API's error if the change is refused. */
export function StatusSelect({
  projectId,
  taskId,
  status,
}: {
  projectId: string;
  taskId: string;
  status: TaskStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function change(next: TaskStatus) {
    setError(undefined);
    startTransition(async () => {
      const result = await moveTaskAction(projectId, taskId, next);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className={styles.statusBox}>
      <select
        className={styles.statusSelect}
        aria-label="Estado"
        value={status}
        disabled={pending}
        onChange={(event) => change(event.target.value as TaskStatus)}
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
