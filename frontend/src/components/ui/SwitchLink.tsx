import Link from "next/link";
import styles from "./SwitchLink.module.css";

type Props = { label: string; href: string; on: boolean };

/** On/off switch made of a link to the opposite state, so it lives in the URL. */
export function SwitchLink({ label, href, on }: Props) {
  return (
    <Link href={href} className={styles.switch} role="switch" aria-checked={on}>
      <i className={[styles.track, on && styles.on].filter(Boolean).join(" ")} />
      {label}
    </Link>
  );
}
