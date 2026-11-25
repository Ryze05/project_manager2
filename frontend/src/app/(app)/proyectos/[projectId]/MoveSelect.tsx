"use client";

import { useState, useTransition } from "react";
import type { TaskStatus } from "@/lib/types";
import { moveTaskAction } from "./actions";
import styles from "./board.module.css";

const LABELS: Record<TaskStatus, string> = {
  TODO: "Por hacer",
  IN_PROGRESS: "En curso",
  DONE: "Hecha",
};

/** "Mover a…" menu of a card: the other two columns. Shows the API's error if the move is refused. */
export function MoveSelect({
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

  function move(next: TaskStatus) {
    setError(undefined);
    startTransition(async () => {
      const result = await moveTaskAction(projectId, taskId, next);
      if (result.error) setError(result.error);
    });
  }

  // The card is draggable: what is done on this menu must never start (or feed) a drag.
  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

  return (
    <div onPointerDown={stop} onTouchStart={stop} onKeyDown={stop}>
      <select
        className={styles.move}
        aria-label="Mover tarea a"
        value=""
        disabled={pending}
        onChange={(event) => move(event.target.value as TaskStatus)}
      >
        <option value="" disabled>
          {pending ? "Moviendo…" : "Mover a…"}
        </option>
        {(Object.keys(LABELS) as TaskStatus[])
          .filter((value) => value !== status)
          .map((value) => (
            <option key={value} value={value}>
              {LABELS[value]}
            </option>
          ))}
      </select>
      {error && (
        <p className={styles.moveError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
