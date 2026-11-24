import { useId, type InputHTMLAttributes } from "react";
import styles from "./Input.module.css";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

/** Text field with an optional label, hint and error (the error replaces the hint). */
export function Input({ label, hint, error, id, className, ...rest }: Props) {
  const generated = useId();
  const inputId = id ?? generated;
  const describedBy = error || hint ? `${inputId}-desc` : undefined;
  const input = (
    <input
      id={inputId}
      className={[styles.input, error && styles.invalid, className]
        .filter(Boolean)
        .join(" ")}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      {...rest}
    />
  );

  if (!label && !hint && !error) return input;
  return (
    <div className={styles.field}>
      {label && <label htmlFor={inputId}>{label}</label>}
      {input}
      {(error || hint) && (
        <span
          id={describedBy}
          className={error ? styles.error : styles.hint}
          role={error ? "alert" : undefined}
        >
          {error ?? hint}
        </span>
      )}
    </div>
  );
}
