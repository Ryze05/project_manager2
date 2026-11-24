/** Shapes returned by the API (see the backend's `*View` types). */

export type ProjectRole = "OWNER" | "MEMBER";

export interface ProjectView {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  /** Role of the signed-in user in this project. */
  role: ProjectRole;
  memberCount: number;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
}

export interface MemberView {
  id: string;
  name: string;
  email: string;
  role: ProjectRole;
}

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export interface TaskView {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  projectId: string;
  /** null for a regular task, the parent's id for a subtask. */
  parentId: string | null;
  creatorId: string;
  assignee: { id: string; name: string; email: string } | null;
  subtaskProgress: { done: number; total: number };
  createdAt: string;
  updatedAt: string;
}

/** The three columns, always present, already ordered by the API. */
export type Board = Record<TaskStatus, TaskView[]>;

export interface CommentView {
  id: string;
  content: string;
  createdAt: string;
  /** null until the comment is edited. */
  editedAt: string | null;
  taskId: string;
  author: { id: string; name: string; email: string };
}
