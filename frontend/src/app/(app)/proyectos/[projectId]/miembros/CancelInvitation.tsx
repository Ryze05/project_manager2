"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { cancelInvitationAction } from "./actions";

/** "Cancelar" of a pending invitation (nothing is lost: no dialog). */
export function CancelInvitation({
  projectId,
  invitationId,
}: {
  projectId: string;
  invitationId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function cancel() {
    setError(undefined);
    startTransition(async () => {
      const result = await cancelInvitationAction(projectId, invitationId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <>
      <Button variant="ghost" onClick={cancel} disabled={pending}>
        {pending ? "Cancelando…" : "Cancelar invitación"}
      </Button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
