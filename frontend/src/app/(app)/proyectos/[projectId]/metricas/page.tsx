import Link from "next/link";
import { Card, ProgressBar } from "@/components/ui";
import { getMetrics, getProject } from "@/lib/queries";
import projectStyles from "../../projects.module.css";
import { AssigneeChart, StatusChart } from "./MetricsCharts";
import styles from "./metrics.module.css";

export const metadata = { title: "Métricas · Gestor de proyectos" };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function MetricsPage({
  params,
}: PageProps<"/proyectos/[projectId]/metricas">) {
  const { projectId } = await params;
  const [project, metrics] = await Promise.all([getProject(projectId), getMetrics(projectId)]);
  const { tasks, subtasks } = metrics;

  return (
    <div className={projectStyles.page}>
      <Link href={`/proyectos/${projectId}`} className={projectStyles.back}>
        ← {project.name}
      </Link>
      <header className={projectStyles.head}>
        <div>
          <p className={projectStyles.eyebrow}>{project.name}</p>
          <h1>Métricas</h1>
        </div>
      </header>

      {tasks.total === 0 ? (
        <div className={projectStyles.empty}>
          <p>Todavía no hay tareas: las métricas aparecerán cuando las haya.</p>
        </div>
      ) : (
        <div className={styles.layout}>
          <section className={styles.kpis} aria-label="Resumen">
            <Card className={styles.kpi}>
              <span className={styles.kpiLabel}>Completado</span>
              <b className={styles.kpiValue}>{Math.round((tasks.done / tasks.total) * 100)}%</b>
              <ProgressBar done={tasks.done} total={tasks.total} />
            </Card>
            <Card className={styles.kpi}>
              <span className={styles.kpiLabel}>Vencidas</span>
              <b className={[styles.kpiValue, metrics.overdue > 0 && styles.late].filter(Boolean).join(" ")}>
                {metrics.overdue}
              </b>
              <span className={styles.kpiHint}>sin terminar y fuera de plazo</span>
            </Card>
            <Card className={styles.kpi}>
              <span className={styles.kpiLabel}>Próximos 7 días</span>
              <b className={styles.kpiValue}>{metrics.dueSoon}</b>
              <span className={styles.kpiHint}>vencen hoy o esta semana</span>
            </Card>
            <Card className={styles.kpi}>
              <span className={styles.kpiLabel}>Sin responsable</span>
              <b className={styles.kpiValue}>{metrics.unassigned}</b>
              <span className={styles.kpiHint}>sin terminar y sin asignar</span>
            </Card>
          </section>

          <Card>
            <h3>Tareas por estado</h3>
            <StatusChart tasks={tasks} />
            {subtasks.total > 0 && (
              <div className={styles.subtasks}>
                <span>
                  Subtareas: {plural(subtasks.done, "hecha", "hechas")} de {subtasks.total}
                </span>
                <ProgressBar done={subtasks.done} total={subtasks.total} />
              </div>
            )}
          </Card>

          <Card>
            <h3>Por responsable</h3>
            <p className={projectStyles.small}>
              Tareas de cada miembro, por estado. Las subtareas no cuentan aquí.
            </p>
            <AssigneeChart rows={metrics.byAssignee} />
          </Card>
        </div>
      )}
    </div>
  );
}
