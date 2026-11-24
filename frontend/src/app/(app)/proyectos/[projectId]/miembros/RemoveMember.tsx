"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete/ConfirmDelete";
import { removeMemberAction } from "./actions";

/** "Quitar" button of a member row, with confirmation. */
export function RemoveMember({
  projectId,
  userId,
  name,
}: {
  projectId: string;
  userId: string;
  name: string;
}) {
  return (
    <ConfirmDelete
      action={() => removeMemberAction(projectId, userId)}
      label="Quitar"
      title={`¿Quitar a ${name} del proyecto?`}
      description="Sus tareas y subtareas quedarán sin responsable. Sus comentarios se conservan."
      confirmLabel="Sí, quitar"
      pendingLabel="Quitando…"
    />
  );
}
