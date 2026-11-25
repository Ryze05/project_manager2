import Link from "next/link";
import { Badge, ButtonLink } from "@/components/ui";
import { hasFilters, parseFilters, toQuery } from "@/lib/board-filters";
import { getBoard, getLabels, getMe, getMembers, getProject } from "@/lib/queries";
import type { TaskStatus, TaskView } from "@/lib/types";
import styles from "../projects.module.css";
import boardStyles from "./board.module.css";
import { BoardFilters } from "./BoardFilters";
import { TaskCard } from "./TaskCard";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "TODO", label: "Por hacer" },
  { status: "IN_PROGRESS", label: "En curso" },
  { status: "DONE", label: "Hecha" },
];

export default async function ProjectPage({
  params,
  searchParams,
}: PageProps<"/proyectos/[projectId]">) {
  const { projectId } = await params;
  const filters = parseFilters(await searchParams);
  const filtered = hasFilters(filters);
  const [project, board, me, labels, members] = await Promise.all([
    getProject(projectId),
    getBoard(projectId, toQuery(filters)),
    getMe(),
    getLabels(projectId),
    getMembers(projectId),
  ]);
  const isOwner = project.role === "OWNER";
  // Filtering by a person also brings the tasks where only a subtask is theirs: say so on those cards.
  const filteredBy = members.find((m) => m.id === filters.assignee);
  const viaSubtask = (task: TaskView) =>
    filteredBy && task.assignee?.id !== filteredBy.id ? filteredBy.name : undefined;

  return (
    <div className={styles.page}>
      <Link href="/proyectos" className={styles.back}>
        ← Proyectos
      </Link>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>{project.description ?? "Sin descripción"}</p>
          <h1>{project.name}</h1>
        </div>
        <div className={styles.actions}>
          <Badge tone={isOwner ? "accent" : "neutral"}>
            {isOwner ? "Propietario" : "Miembro"}
          </Badge>
          <ButtonLink href={`/proyectos/${projectId}/miembros`} variant="ghost">
            Miembros <span className={styles.count}>{project.memberCount}</span>
          </ButtonLink>
          <ButtonLink href={`/proyectos/${projectId}/actividad`} variant="ghost">
            Actividad
          </ButtonLink>
          {isOwner && (
            <ButtonLink href={`/proyectos/${projectId}/editar`} variant="ghost">
              Editar
            </ButtonLink>
          )}
          <ButtonLink href={`/proyectos/${projectId}/tareas/nueva`}>Nueva tarea</ButtonLink>
        </div>
      </header>

      <BoardFilters projectId={projectId} filters={filters} labels={labels} members={members} />

      <div className={boardStyles.board}>
        {COLUMNS.map(({ status, label }) => (
          <section key={status} className={boardStyles.column} aria-label={label}>
            <h2 className={boardStyles.columnHead}>
              {label} <span className={boardStyles.count}>{board[status].length}</span>
            </h2>
            {board[status].length === 0 ? (
              <p className={boardStyles.empty}>{filtered ? "Ninguna coincide" : "Sin tareas"}</p>
            ) : (
              <ul className={boardStyles.cards}>
                {board[status].map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    currentUserId={me.id}
                    viaSubtaskOf={viaSubtask(task)}
                  />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
