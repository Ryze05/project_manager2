import Link from "next/link";
import styles from "./Segmented.module.css";

type Props = {
  label: string;
  options: { label: string; href: string; active: boolean }[];
};

/** Pill-shaped choice between a few views. Made of links, so the choice lives in the URL. */
export function Segmented({ label, options }: Props) {
  return (
    <div className={styles.segmented} role="group" aria-label={label}>
      {options.map((option) => (
        <Link
          key={option.label}
          href={option.href}
          className={styles.option}
          aria-current={option.active ? "true" : undefined}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}
