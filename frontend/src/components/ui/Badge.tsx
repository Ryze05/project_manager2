import type { HTMLAttributes } from "react";
import styles from "./Badge.module.css";

type Props = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "accent" | "danger" | "outline";
  dot?: boolean;
};

export function Badge({ tone = "neutral", dot = false, className, ...rest }: Props) {
  const classes = [styles.badge, styles[tone], dot && styles.dot, className]
    .filter(Boolean)
    .join(" ");
  return <span className={classes} {...rest} />;
}
