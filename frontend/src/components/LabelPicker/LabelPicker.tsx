import type { LabelView } from "@/lib/types";
import styles from "./LabelPicker.module.css";

type Props = {
  labels: LabelView[];
  /** Name of the checkbox group (one value per label id). */
  name: string;
  selected?: string[];
  legend: string;
  /** No visible title and no wrapper spacing, to sit inline in a toolbar. */
  bare?: boolean;
};

/** Labels as toggle capsules (native checkboxes, so it works inside any form, even a GET one). */
export function LabelPicker({ labels, name, selected = [], legend, bare = false }: Props) {
  if (labels.length === 0) return null;
  return (
    <fieldset className={[styles.fieldset, bare && styles.bare].filter(Boolean).join(" ")}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.chips}>
        {labels.map((label) => (
          <label key={label.id} className={styles.chip}>
            <input
              type="checkbox"
              name={name}
              value={label.id}
              defaultChecked={selected.includes(label.id)}
              className={styles.input}
            />
            <span className={styles.text}>{label.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
