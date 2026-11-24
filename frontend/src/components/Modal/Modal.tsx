"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./Modal.module.css";

type Props = {
  open: boolean;
  /** Called when the dialog closes itself (Esc key). */
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/** Native modal dialog (focus trap, Esc and backdrop come with the platform), driven by `open`. */
export function Modal({ open, onClose, title, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog ref={dialog} className={styles.dialog} onClose={onClose} aria-label={title}>
      <h3 className={styles.title}>{title}</h3>
      {open && children}
    </dialog>
  );
}
