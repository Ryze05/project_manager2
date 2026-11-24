import { useId, type SelectHTMLAttributes } from "react";
import styles from "./Input.module.css";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

/** Native select with the look of `Input`. Options go in as children. */
export function Select({ label, hint, error, id, className, children, ...rest }: Props) {
  const generated = useId();
  const selectId = id ?? generated;
  const describedBy = error || hint ? `${selectId}-desc` : undefined;
  return (
    <div className={styles.field}>
      {label && <label htmlFor={selectId}>{label}</label>}
      <select
        id={selectId}
        className={[styles.input, error && styles.invalid, className].filter(Boolean).join(" ")}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      >
        {children}
      </select>
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
