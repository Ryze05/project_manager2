"use client";

import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";

/**
 * A GET form that applies itself on every change: it builds the URL from the
 * fields (leaving out the empty ones, so the address stays clean) and navigates.
 * Without JavaScript it is still a plain GET form (see the `noscript` button).
 */
export function AutoForm({
  action,
  className,
  label,
  children,
}: {
  action: string;
  className?: string;
  label: string;
  children: ReactNode;
}) {
  const router = useRouter();

  function apply(event: FormEvent<HTMLFormElement>) {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) {
      if (typeof value === "string" && value !== "") params.append(key, value);
    }
    const qs = params.toString();
    router.push(qs ? `${action}?${qs}` : action);
  }

  return (
    <form
      action={action}
      method="get"
      className={className}
      aria-label={label}
      onChange={apply}
      onSubmit={(event) => {
        event.preventDefault();
        apply(event);
      }}
    >
      {children}
      <noscript>
        <button type="submit">Filtrar</button>
      </noscript>
    </form>
  );
}
