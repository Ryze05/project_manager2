import { Avatar, Badge, ProgressBar } from "@/components/ui";
import { formatDueDate, isOverdue } from "@/lib/format";
import type { TaskPriority, TaskView } from "@/lib/types";
import styles from "./board.module.css";
import { MoveSelect } from "./MoveSelect";

const PRIORITY: Record<TaskPriority, { label: string; tone: "danger" | "neutral" | "outline" }> = {
  HIGH: { label: "Alta", tone: "danger" },
  MEDIUM: { label: "Media", tone: "neutral" },
  LOW: { label: "Baja", tone: "outline" },
};

export function TaskCard({
  task,
  currentUserId,
}: {
  task: TaskView;
  currentUserId: string;
}) {
  const done = task.status === "DONE";
  const priority = PRIORITY[task.priority];
  const late = !done && task.dueDate !== null && isOverdue(task.dueDate);

  return (
    <li className={[styles.card, done && styles.done].filter(Boolean).join(" ")}>
      <span className={styles.title}>{task.title}</span>
      <div className={styles.row}>
        <Badge tone={priority.tone} dot>
          {priority.label}
        </Badge>
        <span className={late ? styles.late : styles.small}>
          {task.dueDate ? formatDueDate(task.dueDate) : "Sin fecha"}
        </span>
      </div>
      <ProgressBar done={task.subtaskProgress.done} total={task.subtaskProgress.total} />
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
