"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Input, Select, Textarea } from "@/components/ui";
import type { MemberView } from "@/lib/types";
import { type TaskFormState } from "../actions";
import styles from "../../projects.module.css";

type Props = {
  action: (state: TaskFormState, formData: FormData) => Promise<TaskFormState>;
  members: MemberView[];
  /** Where "Cancelar" goes when the form is a page... */
  cancelHref?: string;
  /** ...or what it does when the form lives in a modal. */
  onCancel?: () => void;
  /** Called after a save that stays on the page (the modal uses it to close). */
  onSaved?: () => void;
  submitLabel: string;
  pendingLabel: string;
  /** Current values when editing. */
  initial?: NonNullable<TaskFormState["values"]>;
};

/** Fields shared by "new task" and "edit task". */
export function TaskForm({
  action,
  members,
  cancelHref,
  onCancel,
  onSaved,
  submitLabel,
  pendingLabel,
  initial,
}: Props) {
  const [state, formAction, pending] = useActionState(
    async (prev: TaskFormState, formData: FormData) => {
      const next = await action(prev, formData);
      // No errors and no message: the save worked (a page action would have redirected).
      if (!next.errors && !next.message) onSaved?.();
      return next;
    },
    {} as TaskFormState,
  );
  const values = state.values ?? initial;

  return (
    <form action={formAction} className={styles.form} noValidate>
      <Input
        name="title"
        label="Título"
        placeholder="Diseñar la base de datos"
        maxLength={200}
        defaultValue={values?.title}
        error={state.errors?.title}
        autoFocus
      />
      <Textarea
        name="description"
        label="Descripción"
        hint="Opcional"
        maxLength={5000}
        defaultValue={values?.description}
        error={state.errors?.description}
      />
      <div className={styles.twoCols}>
        <Select name="priority" label="Prioridad" defaultValue={values?.priority ?? "MEDIUM"}>
          <option value="HIGH">Alta</option>
          <option value="MEDIUM">Media</option>
          <option value="LOW">Baja</option>
        </Select>
        <Input
          name="dueDate"
          type="date"
          label="Fecha límite"
          hint="Opcional"
          defaultValue={values?.dueDate}
        />
      </div>
      <Select name="assigneeId" label="Responsable" defaultValue={values?.assigneeId ?? ""}>
        <option value="">Sin responsable</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </Select>
      {state.message && (
        <p className={styles.error} role="alert">
          {state.message}
        </p>
      )}
      <div className={styles.formActions}>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
        ) : (
          <Link href={cancelHref ?? "/"} className={styles.cancel}>
            Cancelar
          </Link>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
