"use client";

import { useState, type ComponentProps } from "react";
import { Input } from "./Input";
import styles from "./PasswordInput.module.css";

type Props = Omit<ComponentProps<typeof Input>, "type" | "adornment">;

/** Password field with an eye button to show what is typed. */
export function PasswordInput(props: Props) {
  const [visible, setVisible] = useState(false);
  const label = visible ? "Ocultar contraseña" : "Mostrar contraseña";

  return (
    <Input
      {...props}
      type={visible ? "text" : "password"}
      adornment={
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setVisible((v) => !v)}
          aria-label={label}
          title={label}
          aria-pressed={visible}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="M4 4l16 16" />}
          </svg>
        </button>
      }
    />
  );
}
