"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { archiveProjectAction, unarchiveProjectAction } from "./actions";

/** Archives or unarchives a project (reversible, so no confirmation dialog). */
export function ArchiveButton({ projectId, archived }: { projectId: string; archived: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function toggle() {
    setError(undefined);
    startTransition(async () => {
      const result = await (archived ? unarchiveProjectAction : archiveProjectAction)(projectId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <>
      <Button variant="ghost" onClick={toggle} disabled={pending}>
        {pending ? "Un momento…" : archived ? "Desarchivar proyecto" : "Archivar proyecto"}
      </Button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
