"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { LabelPicker } from "@/components/LabelPicker/LabelPicker";
import type { LabelView, MemberView } from "@/lib/types";
import { type TaskFormState } from "../actions";
import styles from "../../projects.module.css";

type Props = {
  action: (state: TaskFormState, formData: FormData) => Promise<TaskFormState>;
  members: MemberView[];
  /** The project's labels. Left out for subtasks, which carry none (and then no label field is shown). */
  labels?: LabelView[];
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
  initialLabelIds?: string[];
};

/** Fields shared by "new task" and "edit task". */
export function TaskForm({
  action,
  members,
  labels,
  cancelHref,
  onCancel,
  onSaved,
  submitLabel,
  pendingLabel,
  initial,
  initialLabelIds,
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
  // `key` remounts the capsules when a failed save echoes back what was ticked.
  const ticked = state.labels?.ids ?? initialLabelIds ?? [];

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
      {labels && (
        <>
          <input type="hidden" name="hasLabels" value="1" />
          <LabelPicker
            key={ticked.join(",")}
            labels={labels}
            name="labelId"
            selected={ticked}
            legend="Etiquetas"
          />
          <Input
            name="newLabels"
            label={labels.length > 0 ? "Etiquetas nuevas" : "Etiquetas"}
            hint="Opcional. Sepáralas con comas: urgente, diseño"
            defaultValue={state.labels?.added}
          />
        </>
      )}
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
