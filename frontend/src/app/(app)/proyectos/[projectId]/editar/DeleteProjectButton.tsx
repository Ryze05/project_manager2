"use client";

import { useRef, useTransition } from "react";
import { Button } from "@/components/ui";
import styles from "../../projects.module.css";

/** Asks for confirmation in a native modal dialog before running the delete action. */
export function DeleteProjectButton({
  action,
  projectName,
}: {
  action: () => Promise<void>;
  projectName: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant="danger" onClick={() => dialog.current?.showModal()}>
        Eliminar proyecto
      </Button>
      <dialog ref={dialog} className={styles.dialog}>
        <h3>¿Eliminar «{projectName}»?</h3>
        <p className={styles.dangerText}>
          Se borrará con todo su contenido para todos los miembros.
        </p>
        <div className={styles.formActions}>
          <Button variant="ghost" onClick={() => dialog.current?.close()} disabled={pending}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => startTransition(() => action())}
          >
            {pending ? "Eliminando…" : "Sí, eliminar"}
          </Button>
        </div>
      </dialog>
    </>
  );
}
