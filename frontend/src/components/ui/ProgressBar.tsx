import styles from "./ProgressBar.module.css";

type Props = { done: number; total: number; label?: string };

/** Subtask / task progress such as "2/3". Shows nothing when there is nothing to count. */
export function ProgressBar({ done, total, label }: Props) {
  if (total <= 0) return null;
  const percent = Math.round((Math.min(done, total) / total) * 100);
  return (
    <div className={styles.progress}>
      <div
        className={styles.bar}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <i style={{ width: `${percent}%` }} />
      </div>
      <span>{label ?? `${done}/${total}`}</span>
    </div>
  );
}
