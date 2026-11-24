import { useId, type TextareaHTMLAttributes } from "react";
import styles from "./Input.module.css";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

/** Multi-line field; shares the look (and CSS) of `Input`. */
export function Textarea({ label, hint, error, id, className, rows = 4, ...rest }: Props) {
  const generated = useId();
  const textareaId = id ?? generated;
  const describedBy = error || hint ? `${textareaId}-desc` : undefined;
  return (
    <div className={styles.field}>
      {label && <label htmlFor={textareaId}>{label}</label>}
      <textarea
        id={textareaId}
        rows={rows}
        className={[styles.input, styles.textarea, error && styles.invalid, className]
          .filter(Boolean)
          .join(" ")}
        style={{ ["--rows" as string]: rows }}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
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
