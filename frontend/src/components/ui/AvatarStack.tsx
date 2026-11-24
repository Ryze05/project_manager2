import { Avatar } from "./Avatar";
import styles from "./AvatarStack.module.css";

type Person = { id: string; name: string };

type Props = {
  people: Person[];
  /** The signed-in user gets the solid accent. */
  meId?: string;
  /** How many initials to show before collapsing the rest into "+N". */
  max?: number;
};

/** Overlapping initials of several people. Shows nothing for an empty list. */
export function AvatarStack({ people, meId, max = 3 }: Props) {
  if (people.length === 0) return null;
  const shown = people.slice(0, max);
  const hidden = people.length - shown.length;
  return (
    <span className={styles.stack} title={people.map((p) => p.name).join(", ")}>
      {shown.map((person) => (
        <span key={person.id} className={styles.item}>
          <Avatar name={person.name} me={person.id === meId} />
        </span>
      ))}
      {hidden > 0 && <span className={`${styles.item} ${styles.more}`}>+{hidden}</span>}
    </span>
  );
}
