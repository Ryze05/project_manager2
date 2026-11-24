import { Card } from "@/components/ui";
import { api, unwrap } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { CommentView } from "@/lib/types";
import { CommentForm } from "./CommentForm";
import { CommentItem } from "./CommentItem";
import styles from "./comments.module.css";

/** Comment thread of a task or subtask, oldest first, with the box to write a new one. */
export async function Comments({
  projectId,
  taskId,
  currentUserId,
  isOwner,
}: {
  projectId: string;
  taskId: string;
  currentUserId: string;
  isOwner: boolean;
}) {
  const comments = await unwrap(
    await api<CommentView[]>(`/projects/${projectId}/tasks/${taskId}/comments`),
  );

  return (
    <Card>
      <div className={styles.label}>
        <span>Comentarios</span>
        {comments.length > 0 && <span>{comments.length}</span>}
      </div>
      {comments.length > 0 && (
        <ul className={styles.list}>
          {comments.map((comment) => {
            const isMine = comment.author.id === currentUserId;
            return (
              <CommentItem
                key={comment.id}
                projectId={projectId}
                taskId={taskId}
                comment={comment}
                when={timeAgo(comment.createdAt)}
                isMine={isMine}
                canDelete={isMine || isOwner}
              />
            );
          })}
        </ul>
      )}
      <CommentForm projectId={projectId} taskId={taskId} />
    </Card>
  );
}
