import styles from "./Avatar.module.css";

type Props = {
  name: string;
  /** "person" is round, "project" is a rounded square. */
  shape?: "person" | "project";
  size?: "sm" | "lg";
  /** The signed-in user gets the solid accent. */
  me?: boolean;
};

/** Initial of a person or project. A single variant on purpose (no colour per item). */
export function Avatar({ name, shape = "person", size = "sm", me = false }: Props) {
  const classes = [styles.avatar, styles[shape], styles[size], me && styles.me]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={classes} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
