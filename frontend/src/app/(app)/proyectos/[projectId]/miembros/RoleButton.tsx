"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { changeRoleAction } from "./actions";

/** "Hacer propietario" of a member row (promoting is easy to undo: no dialog). */
export function RoleButton({
  projectId,
  userId,
  promote,
}: {
  projectId: string;
  userId: string;
  /** True: make this member an owner. False: take the owner role away. */
  promote: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function change() {
    setError(undefined);
    startTransition(async () => {
      const result = await changeRoleAction(projectId, userId, promote ? "OWNER" : "MEMBER");
      if (result.error) setError(result.error);
    });
  }

  return (
    <>
      <Button variant="ghost" onClick={change} disabled={pending}>
        {pending ? "Un momento…" : promote ? "Hacer propietario" : "Quitar propietario"}
      </Button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
