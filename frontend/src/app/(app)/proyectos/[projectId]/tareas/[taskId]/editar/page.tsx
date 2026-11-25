import Link from "next/link";
import { Card } from "@/components/ui";
import { getLabels, getMembers, getTask } from "@/lib/queries";
import projectStyles from "../../../../projects.module.css";
import { updateTaskAction } from "../../../actions";
import { TaskForm } from "../../TaskForm";

export const metadata = { title: "Editar tarea · Gestor de proyectos" };

export default async function EditTaskPage({
  params,
}: PageProps<"/proyectos/[projectId]/tareas/[taskId]/editar">) {
  const { projectId, taskId } = await params;
  const [task, members, labels] = await Promise.all([
    getTask(projectId, taskId),
    getMembers(projectId),
    getLabels(projectId),
  ]);
  const back = `/proyectos/${projectId}/tareas/${taskId}`;

  return (
    <div className={projectStyles.formPage}>
      <Link href={back} className={projectStyles.back}>
        ← {task.title}
      </Link>
      <header className={projectStyles.head}>
        <h1>{task.parentId ? "Editar subtarea" : "Editar tarea"}</h1>
      </header>
      <Card>
        <TaskForm
          action={updateTaskAction.bind(null, projectId, taskId)}
          members={members}
          // Subtasks carry no labels: without the prop the form shows no label field.
          labels={task.parentId ? undefined : labels}
          initialLabelIds={task.labels.map((l) => l.id)}
          cancelHref={back}
          submitLabel="Guardar cambios"
          pendingLabel="Guardando…"
          initial={{
            title: task.title,
            description: task.description ?? "",
            priority: task.priority,
            dueDate: task.dueDate?.slice(0, 10) ?? "",
            assigneeId: task.assignee?.id ?? "",
          }}
        />
      </Card>
    </div>
  );
}
