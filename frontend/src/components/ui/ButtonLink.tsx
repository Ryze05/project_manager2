import Link from "next/link";
import type { ComponentProps } from "react";
import styles from "./Button.module.css";

type Props = ComponentProps<typeof Link> & {
  variant?: "primary" | "ghost";
};

/** A link that looks like a `Button`: for navigation, where a button would be an action. */
export function ButtonLink({ variant = "primary", className, ...rest }: Props) {
  const classes = [styles.button, styles[variant], styles.asLink, className]
    .filter(Boolean)
    .join(" ");
  return <Link className={classes} {...rest} />;
}
