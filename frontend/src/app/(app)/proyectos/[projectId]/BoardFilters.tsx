import Link from "next/link";
import { LabelPicker } from "@/components/LabelPicker/LabelPicker";
import { hasFilters, type BoardFilters as Filters } from "@/lib/board-filters";
import type { LabelView, MemberView } from "@/lib/types";
import { AutoForm } from "./AutoForm";
import styles from "./filters.module.css";

type Props = {
  projectId: string;
  filters: Filters;
  labels: LabelView[];
  members: MemberView[];
};

/**
 * One compact row. The state lives in the URL (shareable, survives a reload) and
 * is applied on every change. The first option of each select names the filter.
 */
export function BoardFilters({ projectId, filters, labels, members }: Props) {
  const board = `/proyectos/${projectId}`;
  return (
    <AutoForm action={board} className={styles.bar} label="Filtros del tablero">
      <select
        name="assignee"
        aria-label="Responsable"
        defaultValue={filters.assignee}
        className={`${styles.select} ${filters.assignee ? styles.active : ""}`}
      >
        <option value="">Responsable</option>
        <option value="none">Sin responsable</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </select>
      <select
        name="priority"
        aria-label="Prioridad"
        defaultValue={filters.priority[0] ?? ""}
        className={`${styles.select} ${filters.priority.length ? styles.active : ""}`}
      >
        <option value="">Prioridad</option>
        <option value="HIGH">Alta</option>
        <option value="MEDIUM">Media</option>
        <option value="LOW">Baja</option>
      </select>
      <select
        name="due"
        aria-label="Fecha límite"
        defaultValue={filters.due}
        className={`${styles.select} ${filters.due ? styles.active : ""}`}
      >
        <option value="">Fecha límite</option>
        <option value="overdue">Vencidas</option>
        <option value="week">Próximos 7 días</option>
        <option value="none">Sin fecha</option>
      </select>
      <LabelPicker labels={labels} name="label" selected={filters.label} legend="Etiquetas" bare />
      {hasFilters(filters) && (
        <Link href={board} className={styles.clear}>
          Quitar filtros
        </Link>
      )}
    </AutoForm>
  );
}
