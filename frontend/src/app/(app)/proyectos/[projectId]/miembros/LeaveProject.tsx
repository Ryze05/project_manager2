"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete/ConfirmDelete";
import { leaveProjectAction } from "./actions";

/** "Dejar el proyecto" for the signed-in user, with confirmation. */
export function LeaveProject({ projectId, name }: { projectId: string; name: string }) {
  return (
    <ConfirmDelete
      action={() => leaveProjectAction(projectId)}
      label="Dejar el proyecto"
      title={`¿Dejar «${name}»?`}
      description="Dejarás de ver el proyecto y tus tareas quedarán sin responsable. Tus comentarios se conservan. Solo podrás volver si un propietario te añade."
      confirmLabel="Sí, dejar"
      pendingLabel="Saliendo…"
    />
  );
}
