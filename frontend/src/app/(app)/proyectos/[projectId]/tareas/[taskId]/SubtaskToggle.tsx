"use client";

import { useTransition } from "react";
import type { TaskStatus } from "@/lib/types";
import { moveTaskAction } from "../../actions";
import styles from "./task.module.css";

/** Check box of a subtask: done <-> to do. */
export function SubtaskToggle({
  projectId,
  subtaskId,
  done,
}: {
  projectId: string;
  subtaskId: string;
  done: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next: TaskStatus = done ? "TODO" : "DONE";
    startTransition(async () => {
      const result = await moveTaskAction(projectId, subtaskId, next);
      if (result.error) throw new Error(result.error);
    });
  }

  return (
    <button
      type="button"
      className={[styles.check, done && styles.checkOn].filter(Boolean).join(" ")}
      aria-label={done ? "Marcar como pendiente" : "Marcar como hecha"}
      aria-pressed={done}
      disabled={pending}
      onClick={toggle}
    >
      {done && "✓"}
    </button>
  );
}
