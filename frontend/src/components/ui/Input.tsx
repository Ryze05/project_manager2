import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import styles from "./Input.module.css";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  /** Element shown inside the field, at its right end (e.g. a show/hide button). */
  adornment?: ReactNode;
};

/** Text field with an optional label, hint and error (the error replaces the hint). */
export function Input({ label, hint, error, adornment, id, className, ...rest }: Props) {
  const generated = useId();
  const inputId = id ?? generated;
  const describedBy = error || hint ? `${inputId}-desc` : undefined;
  const input = (
    <input
      id={inputId}
      className={[
        styles.input,
        error && styles.invalid,
        adornment && styles.withAdornment,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      {...rest}
    />
  );

  const control = adornment ? (
    <div className={styles.control}>
      {input}
      <span className={styles.adornment}>{adornment}</span>
    </div>
  ) : (
    input
  );

  if (!label && !hint && !error) return control;
  return (
    <div className={styles.field}>
      {label && <label htmlFor={inputId}>{label}</label>}
      {control}
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
