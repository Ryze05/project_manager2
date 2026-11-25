"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { loadActivityAction } from "@/app/(app)/proyectos/[projectId]/actividad/actions";
import { Button } from "@/components/ui";
import type { FeedItem } from "@/lib/types";
import styles from "./ActivityFeed.module.css";

type Props = {
  projectId: string;
  /** Narrow to one task; "" for the whole project. */
  taskId?: string;
  items: FeedItem[];
  nextCursor: string | null;
  /** Page size, the same for the first page and the next ones. */
  limit: number;
  /** Only what this person did ("" for everybody); the same one the first page was asked with. */
  actorId?: string;
};

/** The history as a list, newest first, with a button for the older events. */
export function ActivityFeed({ projectId, taskId = "", items: first, nextCursor: firstCursor, limit, actorId = "" }: Props) {
  const [items, setItems] = useState(first);
  const [cursor, setCursor] = useState(firstCursor);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function more() {
    if (!cursor) return;
    setError(undefined);
    startTransition(async () => {
      const result = await loadActivityAction(projectId, taskId, cursor, limit, actorId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setItems((current) => [...current, ...result.items]);
      setCursor(result.nextCursor);
    });
  }

  if (items.length === 0) {
    return (
      <p className={styles.empty}>
        {actorId ? "Esta persona no ha hecho nada todavía." : "Todavía no hay actividad."}
      </p>
    );
  }

  return (
    <>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            <span className={styles.text}>
              <strong>{item.actor}</strong>{" "}
              {item.parts.map((part, i) =>
                part.href ? (
                  <Link key={i} href={part.href} className={styles.link}>
                    {part.text}
                  </Link>
                ) : (
                  <span key={i}>{part.text}</span>
                ),
              )}
            </span>
            <span className={styles.when}>{item.when}</span>
          </li>
        ))}
      </ul>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {cursor && (
        <div className={styles.more}>
          <Button variant="ghost" onClick={more} disabled={pending}>
            {pending ? "Cargando…" : "Ver más"}
          </Button>
        </div>
      )}
    </>
  );
}
