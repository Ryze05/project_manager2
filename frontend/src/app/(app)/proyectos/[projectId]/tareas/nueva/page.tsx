import Link from "next/link";
import { Card } from "@/components/ui";
import { getMembers, getProject } from "@/lib/queries";
import styles from "../../../projects.module.css";
import { createTaskAction } from "../../actions";
import { TaskForm } from "../TaskForm";

export const metadata = { title: "Nueva tarea · Gestor de proyectos" };

export default async function NewTaskPage({
  params,
}: PageProps<"/proyectos/[projectId]/tareas/nueva">) {
  const { projectId } = await params;
  const [project, members] = await Promise.all([
    getProject(projectId),
    getMembers(projectId),
  ]);

  return (
    <div className={styles.formPage}>
      <Link href={`/proyectos/${projectId}`} className={styles.back}>
        ← {project.name}
      </Link>
      <header className={styles.head}>
        <h1>Nueva tarea</h1>
      </header>
      <Card>
        <TaskForm
          action={createTaskAction.bind(null, projectId)}
          members={members}
          cancelHref={`/proyectos/${projectId}`}
          submitLabel="Crear tarea"
          pendingLabel="Creando…"
        />
      </Card>
    </div>
  );
}
