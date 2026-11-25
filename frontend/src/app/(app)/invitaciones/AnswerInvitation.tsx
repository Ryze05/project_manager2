"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { acceptInvitationAction, declineInvitationAction } from "./actions";

/** "Aceptar" / "Rechazar" of one invitation; the API's refusal (e.g. archived project) shows next to them. */
export function AnswerInvitation({ invitationId }: { invitationId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function answer(accept: boolean) {
    setError(undefined);
    startTransition(async () => {
      const result = await (accept ? acceptInvitationAction : declineInvitationAction)(
        invitationId,
      );
      if (result.error) setError(result.error);
    });
  }

  return (
    <>
      <Button onClick={() => answer(true)} disabled={pending}>
        Aceptar
      </Button>
      <Button variant="ghost" onClick={() => answer(false)} disabled={pending}>
        Rechazar
      </Button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
