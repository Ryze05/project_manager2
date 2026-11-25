import Link from "next/link";
import { LabelList } from "@/components/LabelList/LabelList";
import { PriorityBadge } from "@/components/PriorityBadge";
import { Avatar, AvatarStack, ProgressBar } from "@/components/ui";
import { formatDueDate, isOverdue } from "@/lib/format";
import type { TaskView } from "@/lib/types";
import styles from "./board.module.css";
import { MoveSelect } from "./MoveSelect";

export function TaskCard({
  task,
  currentUserId,
  viaSubtaskOf,
}: {
  task: TaskView;
  currentUserId: string;
  /** Name of the person the board is filtered by, when this card only matches through one of its subtasks. */
  viaSubtaskOf?: string;
}) {
  const done = task.status === "DONE";
  const late = !done && task.dueDate !== null && isOverdue(task.dueDate);

  return (
    <li className={[styles.card, done && styles.done].filter(Boolean).join(" ")}>
      <Link href={`/proyectos/${task.projectId}/tareas/${task.id}`} className={styles.title}>
        {task.title}
      </Link>
      <div className={styles.row}>
        <PriorityBadge priority={task.priority} />
        <span className={late ? styles.late : styles.small}>
          {task.dueDate ? formatDueDate(task.dueDate) : "Sin fecha"}
        </span>
      </div>
      {viaSubtaskOf && <p className={styles.via}>Por una subtarea de {viaSubtaskOf}</p>}
      <LabelList labels={task.labels} />
      {task.subtaskProgress.total > 0 && (
        <div className={styles.subtasks}>
          <ProgressBar done={task.subtaskProgress.done} total={task.subtaskProgress.total} />
          <AvatarStack people={task.subtaskAssignees} meId={currentUserId} />
        </div>
      )}
      <div className={styles.row}>
        <MoveSelect projectId={task.projectId} taskId={task.id} status={task.status} />
        {task.assignee ? (
          <span title={task.assignee.name}>
            <Avatar name={task.assignee.name} me={task.assignee.id === currentUserId} />
          </span>
        ) : (
          <span className={styles.small}>Sin responsable</span>
        )}
      </div>
    </li>
  );
}
