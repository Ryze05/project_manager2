"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import type { ActionResult } from "@/lib/types";
import styles from "./ConfirmDelete.module.css";

type Props = {
  /**
   * Server Action (already bound to its ids). On success it redirects or
   * returns nothing; if the API refuses, it returns `{ error }`, shown in the dialog.
   */
  action: () => Promise<ActionResult | void>;
  /** Label of the button that opens the dialog. */
  label: string;
  title: string;
  description: string;
  /** Label of the confirm button (default "Sí, eliminar"). */
  confirmLabel?: string;
  pendingLabel?: string;
};

/** Danger button that asks for confirmation in a native modal dialog before running `action`. */
export function ConfirmDelete({
  action,
  label,
  title,
  description,
  confirmLabel = "Sí, eliminar",
  pendingLabel = "Eliminando…",
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function open() {
    setError(undefined);
    dialog.current?.showModal();
  }

  function confirm() {
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
    });
  }

  return (
    <>
      <Button variant="danger" onClick={open}>
        {label}
      </Button>
      <dialog ref={dialog} className={styles.dialog}>
        <h3>{title}</h3>
        <p className={styles.text}>{description}</p>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => dialog.current?.close()} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="danger" disabled={pending} onClick={confirm}>
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </dialog>
    </>
  );
}
