import Link from "next/link";
import { PriorityBadge } from "@/components/PriorityBadge";
import { TaskCheck } from "@/components/TaskCheck/TaskCheck";
import { Avatar, Badge, Card, Segmented, SwitchLink } from "@/components/ui";
import { getMyTasks } from "@/lib/queries";
import { dueBucket, formatDueDate, type DueBucket } from "@/lib/format";
import type { MyTaskView } from "@/lib/types";
import styles from "./mine.module.css";

export const metadata = { title: "Mis tareas · Gestor de proyectos" };

const BUCKETS: { key: DueBucket; label: string }[] = [
  { key: "overdue", label: "Vencidas" },
  { key: "today", label: "Hoy" },
  { key: "week", label: "Próximos 7 días" },
  { key: "later", label: "Más adelante" },
  { key: "none", label: "Sin fecha" },
  { key: "done", label: "Hechas" },
];

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function MyTasksPage({
  searchParams,
}: PageProps<"/mis-tareas">) {
  const query = await searchParams;
  const byProject = query.agrupar === "proyecto";
  const showDone = query.hechas === "1";

  const tasks = await getMyTasks(showDone);

  /** Link to this page with some of the options changed. */
  const href = (changes: { byProject?: boolean; showDone?: boolean }) => {
    const params = new URLSearchParams();
    if (changes.byProject ?? byProject) params.set("agrupar", "proyecto");
    if (changes.showDone ?? showDone) params.set("hechas", "1");
    const qs = params.toString();
    return qs ? `/mis-tareas?${qs}` : "/mis-tareas";
  };

  const now = new Date();
  const bucketOf = (task: MyTaskView) => dueBucket(task.dueDate, task.status === "DONE", now);

  // The API orders by due date and priority; every grouping keeps that order inside each group.
  const buckets = new Map<DueBucket, MyTaskView[]>();
  for (const task of tasks) {
    const key = bucketOf(task);
    buckets.set(key, [...(buckets.get(key) ?? []), task]);
  }
  const projects = new Map<string, { name: string; tasks: MyTaskView[] }>();
  for (const task of tasks) {
    const group = projects.get(task.project.id) ?? { name: task.project.name, tasks: [] };
    group.tasks.push(task);
    projects.set(task.project.id, group);
  }

  // "1 vencida, 1 para hoy y 2 en curso": in progress counts only what is not already counted.
  const overdue = buckets.get("overdue")?.length ?? 0;
  const today = buckets.get("today")?.length ?? 0;
  const inProgress = tasks.filter(
    (t) => t.status === "IN_PROGRESS" && !["overdue", "today"].includes(bucketOf(t)),
  ).length;

  const pending = tasks.filter((t) => t.status !== "DONE").length;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>Todo lo asignado a ti, de todos tus proyectos</p>
          <h1>Mis tareas</h1>
          <p className={styles.lead}>
            {overdue + today + inProgress === 0 ? (
              pending === 0 ? (
                "Estás al día."
              ) : (
                `Tienes ${plural(pending, "tarea pendiente", "tareas pendientes")}.`
              )
            ) : (
              <>
                Tienes{" "}
                {[
                  overdue > 0 && (
                    <b key="o" className={styles.late}>
                      {plural(overdue, "vencida", "vencidas")}
                    </b>
                  ),
                  today > 0 && <b key="t">{plural(today, "para hoy", "para hoy")}</b>,
                  inProgress > 0 && <b key="i">{inProgress} en curso</b>,
                ]
                  .filter(Boolean)
                  .flatMap((part, index, all) => [
                    part,
                    index < all.length - 2 ? ", " : index === all.length - 2 ? " y " : "",
                  ])}
                .
              </>
            )}
          </p>
        </div>
        <div className={styles.actions}>
          <Segmented
            label="Agrupar"
            options={[
              { label: "Por fecha", href: href({ byProject: false }), active: !byProject },
              { label: "Por proyecto", href: href({ byProject: true }), active: byProject },
            ]}
          />
          <SwitchLink label="Mostrar hechas" href={href({ showDone: !showDone })} on={showDone} />
        </div>
      </header>

      <Card>
        {tasks.length === 0 ? (
          <p className={styles.empty}>
            {showDone ? "No tienes tareas asignadas." : "No tienes tareas pendientes."}
          </p>
        ) : byProject ? (
          [...projects.entries()].map(([projectId, group]) => (
            <section key={projectId} className={styles.group}>
              <div className={styles.groupHead}>
                <Avatar name={group.name} shape="project" />
                <h2 className={styles.projectName}>{group.name}</h2>
                <span className={styles.count}>{group.tasks.length}</span>
              </div>
              <TaskList tasks={group.tasks} withProject={false} />
            </section>
          ))
        ) : (
          BUCKETS.filter(({ key }) => buckets.has(key)).map(({ key, label }) => (
            <section key={key} className={styles.group}>
              <h2 className={[styles.groupLabel, key === "overdue" && styles.groupLate].filter(Boolean).join(" ")}>
                {label} <span className={styles.count}>{buckets.get(key)!.length}</span>
              </h2>
              <TaskList tasks={buckets.get(key)!} withProject />
            </section>
          ))
        )}
      </Card>
    </div>
  );
}

/** Each row is one big link (the title stretches over it); the check box stays usable above it. */
function TaskList({ tasks, withProject }: { tasks: MyTaskView[]; withProject: boolean }) {
  return (
    <ul className={styles.list}>
      {tasks.map((task) => {
        const done = task.status === "DONE";
        const late = !done && dueBucket(task.dueDate, false) === "overdue";
        return (
          <li key={task.id} className={[styles.row, done && styles.isDone].filter(Boolean).join(" ")}>
            <TaskCheck projectId={task.projectId} taskId={task.id} done={done} />
            <div className={styles.body}>
              <Link
                href={`/proyectos/${task.projectId}/tareas/${task.id}`}
                className={styles.title}
              >
                {task.parent && (
                  <span className={styles.arrow} aria-hidden="true">
                    ↳{" "}
                  </span>
                )}
                {task.title}
              </Link>
              {task.parent ? (
                <span className={styles.meta}>
                  en{" "}
                  <Link
                    href={`/proyectos/${task.projectId}/tareas/${task.parent.id}`}
                    className={styles.parentLink}
                  >
                    «{task.parent.title}»
                  </Link>
                </span>
              ) : (
                task.subtaskProgress.total > 0 && (
                  <span className={styles.meta}>
                    {task.subtaskProgress.done}/{task.subtaskProgress.total} subtareas
                  </span>
                )
              )}
            </div>
            {withProject && <Badge tone="outline">{task.project.name}</Badge>}
            <PriorityBadge priority={task.priority} />
            <span className={late ? styles.dateLate : styles.date}>
              {task.dueDate ? formatDueDate(task.dueDate) : "Sin fecha"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
