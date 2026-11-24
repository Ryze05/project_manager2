import Link from "next/link";
import { Card } from "@/components/ui";
import { api, unwrap } from "@/lib/api";
import type { MemberView, TaskView } from "@/lib/types";
import projectStyles from "../../../../projects.module.css";
import { updateTaskAction } from "../../../actions";
import { TaskForm } from "../../TaskForm";

export const metadata = { title: "Editar tarea · Gestor de proyectos" };

export default async function EditTaskPage({
  params,
}: PageProps<"/proyectos/[projectId]/tareas/[taskId]/editar">) {
  const { projectId, taskId } = await params;
  const [task, members] = await Promise.all([
    api<TaskView>(`/projects/${projectId}/tasks/${taskId}`).then(unwrap),
    api<MemberView[]>(`/projects/${projectId}/members`).then(unwrap),
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
