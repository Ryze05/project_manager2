import { Badge } from "@/components/ui";
import styles from "./LabelList.module.css";

/** Neutral capsules with the names of a task's labels (nothing when it has none). */
export function LabelList({ labels }: { labels: { id: string; name: string }[] }) {
  if (labels.length === 0) return null;
  return (
    <ul className={styles.list} aria-label="Etiquetas">
      {labels.map((label) => (
        <li key={label.id}>
          <Badge tone="neutral">{label.name}</Badge>
        </li>
      ))}
    </ul>
  );
}
