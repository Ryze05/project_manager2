"use client";

import { useRef, useTransition } from "react";
import { Button } from "@/components/ui";
import styles from "./ConfirmDelete.module.css";

type Props = {
  /** Server Action (already bound to its ids) that deletes and redirects. */
  action: () => Promise<void>;
  /** Label of the button that opens the dialog. */
  label: string;
  title: string;
  description: string;
};

/** Danger button that asks for confirmation in a native modal dialog before running `action`. */
export function ConfirmDelete({ action, label, title, description }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant="danger" onClick={() => dialog.current?.showModal()}>
        {label}
      </Button>
      <dialog ref={dialog} className={styles.dialog}>
        <h3>{title}</h3>
        <p className={styles.text}>{description}</p>
        <div className={styles.actions}>
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
