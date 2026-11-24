import Link from "next/link";
import { ConfirmDelete } from "@/components/ConfirmDelete/ConfirmDelete";
import { PriorityBadge } from "@/components/PriorityBadge";
import { TaskCheck } from "@/components/TaskCheck/TaskCheck";
import { Avatar, ButtonLink, Card, ProgressBar } from "@/components/ui";
import { formatDueDate, isOverdue } from "@/lib/format";
import {
  getComments,
  getMe,
  getMembers,
  getProject,
  getSubtasks,
  getTask,
} from "@/lib/queries";
import projectStyles from "../../../projects.module.css";
import { deleteTaskAction } from "../../actions";
import { Comments } from "./comments/Comments";
import { CloseTaskHint } from "./CloseTaskHint";
import { NewSubtaskButton } from "./NewSubtaskButton";
import { StatusSelect } from "./StatusSelect";
import styles from "./task.module.css";

/** Detail of a task or a subtask (both are the same entity in the API). */
export default async function TaskPage({
  params,
}: PageProps<"/proyectos/[projectId]/tareas/[taskId]">) {
  const { projectId, taskId } = await params;
  // One round for everything that only needs the ids in the URL (the list of
  // subtasks of a subtask is just empty). Only a subtask needs a second one, for its parent.
  const [project, task, me, subtasks, comments, members] = await Promise.all([
    getProject(projectId),
    getTask(projectId, taskId),
    getMe(),
    getSubtasks(projectId, taskId),
    getComments(projectId, taskId),
    getMembers(projectId),
  ]);
  const isSubtask = task.parentId !== null;
  const parent = task.parentId ? await getTask(projectId, task.parentId) : null;

  const canDelete = project.role === "OWNER" || task.creatorId === me.id;
  const late = task.status !== "DONE" && task.dueDate !== null && isOverdue(task.dueDate);
  const taskPath = `/proyectos/${projectId}/tareas`;

  return (
    <div className={projectStyles.formPage}>
      <Link
        href={parent ? `${taskPath}/${parent.id}` : `/proyectos/${projectId}`}
        className={projectStyles.back}
      >
        ← {parent ? parent.title : project.name}
      </Link>

      <header className={projectStyles.head}>
        <div>
          <p className={projectStyles.eyebrow}>
            {isSubtask ? `Subtarea de «${parent?.title}»` : project.name}
          </p>
          <h1>{task.title}</h1>
        </div>
        <ButtonLink href={`${taskPath}/${taskId}/editar`} variant="ghost">
          Editar
        </ButtonLink>
      </header>

      <div className={projectStyles.stack}>
        <Card>
          <dl className={styles.fields}>
            <dt>Estado</dt>
            <dd>
              <StatusSelect projectId={projectId} taskId={taskId} status={task.status} />
            </dd>
            <dt>Prioridad</dt>
            <dd>
              <PriorityBadge priority={task.priority} />
            </dd>
            <dt>Fecha límite</dt>
            <dd className={late ? styles.late : undefined}>
              {task.dueDate ? formatDueDate(task.dueDate) : "Sin fecha"}
            </dd>
            <dt>Responsable</dt>
            <dd>
              {task.assignee ? (
                <>
                  <Avatar name={task.assignee.name} me={task.assignee.id === me.id} />
                  {task.assignee.name}
                </>
              ) : (
                "Sin responsable"
              )}
            </dd>
          </dl>
        </Card>

        <Card>
          <div className={styles.sectionLabel}>Descripción</div>
          <p className={task.description ? styles.description : styles.descriptionEmpty}>
            {task.description ?? "Sin descripción"}
          </p>
        </Card>

        {!isSubtask && (
          <Card>
            <div className={styles.sectionLabel}>
              <span>Subtareas</span>
              <span>
                {task.subtaskProgress.total > 0 &&
                  `${task.subtaskProgress.done}/${task.subtaskProgress.total}`}
              </span>
            </div>
            <ProgressBar done={task.subtaskProgress.done} total={task.subtaskProgress.total} label=" " />
            {task.subtaskProgress.total > 0 &&
              task.subtaskProgress.done === task.subtaskProgress.total &&
              task.status !== "DONE" && <CloseTaskHint projectId={projectId} taskId={taskId} />}
            <ul className={styles.list}>
              {subtasks.map((subtask) => (
                <li key={subtask.id} className={subtask.status === "DONE" ? styles.isDone : undefined}>
                  <TaskCheck
                    projectId={projectId}
                    taskId={subtask.id}
                    done={subtask.status === "DONE"}
                  />
                  <Link href={`${taskPath}/${subtask.id}`} className={styles.subtaskTitle}>
                    {subtask.title}
                  </Link>
                  {subtask.assignee && (
                    <span title={subtask.assignee.name}>
                      <Avatar name={subtask.assignee.name} me={subtask.assignee.id === me.id} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <NewSubtaskButton projectId={projectId} parentId={taskId} members={members} />
          </Card>
        )}

        <Comments
          comments={comments}
          projectId={projectId}
          taskId={taskId}
          currentUserId={me.id}
          isOwner={project.role === "OWNER"}
        />

        {canDelete && (
          <div className={styles.footer}>
            <ConfirmDelete
              action={deleteTaskAction.bind(null, projectId, taskId, task.parentId)}
              label={isSubtask ? "Eliminar subtarea" : "Eliminar tarea"}
              title={`¿Eliminar «${task.title}»?`}
              description={
                isSubtask
                  ? "Se borrará la subtarea con sus comentarios."
                  : "Se borrará con sus subtareas y comentarios."
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
