"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./Sidebar.module.css";

type Props = {
  href: string;
  children: ReactNode;
  /** Small coloured square before the label (used for recent projects). */
  dot?: boolean;
};

/** Link that highlights itself when the current path is its own or below it. */
export function NavLink({ href, children, dot = false }: Props) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={[styles.link, dot && styles.withDot].filter(Boolean).join(" ")}
      aria-current={active ? "page" : undefined}
    >
      {dot && <span className={styles.dot} />}
      {children}
    </Link>
  );
}
