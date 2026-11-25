"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete/ConfirmDelete";
import { changeRoleAction } from "./actions";

/** "Quitar propietario" of an owner row, with confirmation (it takes powers away, even from yourself). */
export function DemoteOwner({
  projectId,
  userId,
  name,
  isMe,
}: {
  projectId: string;
  userId: string;
  name: string;
  isMe: boolean;
}) {
  return (
    <ConfirmDelete
      action={() => changeRoleAction(projectId, userId, "MEMBER")}
      label="Quitar propietario"
      title={isMe ? "¿Dejar de ser propietario?" : `¿Quitar a ${name} como propietario?`}
      description={
        isMe
          ? "Pasarás a ser miembro: ya no podrás gestionar miembros, etiquetas ni editar o archivar el proyecto."
          : `${name} pasará a ser miembro y perderá el control del proyecto. Quedará constancia en el historial.`
      }
      confirmLabel="Sí, quitar"
      pendingLabel="Quitando…"
    />
  );
}
