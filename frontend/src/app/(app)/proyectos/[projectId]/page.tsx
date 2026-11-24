import Link from "next/link";
import { Badge, ButtonLink } from "@/components/ui";
import { api, unwrap } from "@/lib/api";
import type { Board, CurrentUser, ProjectView, TaskStatus } from "@/lib/types";
import styles from "../projects.module.css";
import boardStyles from "./board.module.css";
import { TaskCard } from "./TaskCard";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "TODO", label: "Por hacer" },
  { status: "IN_PROGRESS", label: "En curso" },
  { status: "DONE", label: "Hecha" },
];

export default async function ProjectPage({
  params,
}: PageProps<"/proyectos/[projectId]">) {
  const { projectId } = await params;
  const [project, board, me] = await Promise.all([
    api<ProjectView>(`/projects/${projectId}`).then(unwrap),
    api<Board>(`/projects/${projectId}/board`).then(unwrap),
    api<CurrentUser>("/auth/me").then(unwrap),
  ]);
  const isOwner = project.role === "OWNER";

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
          {isOwner && (
            <ButtonLink href={`/proyectos/${projectId}/editar`} variant="ghost">
              Editar
            </ButtonLink>
          )}
          <ButtonLink href={`/proyectos/${projectId}/tareas/nueva`}>Nueva tarea</ButtonLink>
        </div>
      </header>

      <div className={boardStyles.board}>
        {COLUMNS.map(({ status, label }) => (
          <section key={status} className={boardStyles.column} aria-label={label}>
            <h2 className={boardStyles.columnHead}>
              {label} <span className={boardStyles.count}>{board[status].length}</span>
            </h2>
            {board[status].length === 0 ? (
              <p className={boardStyles.empty}>Sin tareas</p>
            ) : (
              <ul className={boardStyles.cards}>
                {board[status].map((task) => (
                  <TaskCard key={task.id} task={task} currentUserId={me.id} />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
