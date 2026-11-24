"use client";

import { useTransition } from "react";
import { moveTaskAction } from "@/app/(app)/proyectos/[projectId]/actions";
import type { TaskStatus } from "@/lib/types";
import styles from "./TaskCheck.module.css";

/** Check box of a task or subtask: done <-> to do. */
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

  function toggle() {
    const next: TaskStatus = done ? "TODO" : "DONE";
    startTransition(async () => {
      const result = await moveTaskAction(projectId, taskId, next);
      if (result.error) throw new Error(result.error);
    });
  }

  return (
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
  );
}
