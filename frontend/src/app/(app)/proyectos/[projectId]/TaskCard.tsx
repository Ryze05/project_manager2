import Link from "next/link";
import { PriorityBadge } from "@/components/PriorityBadge";
import { Avatar, AvatarStack, ProgressBar } from "@/components/ui";
import { formatDueDate, isOverdue } from "@/lib/format";
import type { TaskView } from "@/lib/types";
import styles from "./board.module.css";
import { MoveSelect } from "./MoveSelect";

export function TaskCard({
  task,
  currentUserId,
}: {
  task: TaskView;
  currentUserId: string;
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
