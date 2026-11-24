"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal/Modal";
import type { MemberView } from "@/lib/types";
import { createSubtaskAction } from "../../actions";
import { TaskForm } from "../TaskForm";
import styles from "./task.module.css";

/** Last row of the subtask list: opens a modal with the full form for a new subtask. */
export function NewSubtaskButton({
  projectId,
  parentId,
  members,
}: {
  projectId: string;
  parentId: string;
  members: MemberView[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={styles.addRow} onClick={() => setOpen(true)}>
        <span className={styles.plus} aria-hidden="true">
          +
        </span>
        Añadir subtarea
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nueva subtarea">
        <TaskForm
          action={createSubtaskAction.bind(null, projectId, parentId)}
          members={members}
          onCancel={() => setOpen(false)}
          onSaved={() => setOpen(false)}
          submitLabel="Crear subtarea"
          pendingLabel="Creando…"
        />
      </Modal>
    </>
  );
}
