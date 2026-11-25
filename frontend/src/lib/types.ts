/** Shapes returned by the API (see the backend's `*View` types). */

export type ProjectRole = "OWNER" | "MEMBER";

export interface ProjectView {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  /** Null while active; an archived project is read-only. */
  archivedAt: string | null;
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

/** A pending invitation, as the owners of the project see it. */
export interface ProjectInvitationView {
  id: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
  invitedBy: { id: string; name: string };
}

/** A pending invitation, as the invited user sees it. */
export interface MyInvitationView {
  id: string;
  createdAt: string;
  project: { id: string; name: string };
  invitedBy: { id: string; name: string };
}

export interface LabelView {
  id: string;
  name: string;
  /** How many tasks carry it. */
  taskCount: number;
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
  /** Labels of the task, by name (subtasks carry none). */
  labels: { id: string; name: string }[];
  /** Distinct assignees of the subtasks, oldest subtask first. */
  subtaskAssignees: { id: string; name: string }[];
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

/** A task or subtask assigned to the caller, with where it lives (`GET /me/tasks`). */
export interface MyTaskView extends TaskView {
  project: { id: string; name: string };
  parent: { id: string; title: string } | null;
}

/** What a Server Action returns when it can fail without leaving the page. */
export interface ActionResult {
  error?: string;
}

export type ActivityType =
  | "TASK_CREATED"
  | "TASK_DELETED"
  | "TITLE_CHANGED"
  | "DESCRIPTION_CHANGED"
  | "STATUS_CHANGED"
  | "PRIORITY_CHANGED"
  | "DUE_DATE_CHANGED"
  | "ASSIGNEE_CHANGED"
  | "LABEL_ADDED"
  | "LABEL_REMOVED"
  | "COMMENT_ADDED"
  | "MEMBER_ADDED"
  | "MEMBER_REMOVED"
  | "MEMBER_PROMOTED"
  | "MEMBER_DEMOTED"
  | "MEMBER_LEFT"
  | "INVITATION_ACCEPTED";

/** One event of the history (`GET /projects/:id/activity`). */
export interface ActivityView {
  id: string;
  type: ActivityType;
  createdAt: string;
  actor: { id: string; name: string };
  /** null for member events; `deleted` once the task no longer exists. */
  task: { id: string; title: string; isSubtask: boolean; deleted: boolean } | null;
  data: Record<string, string | number | null> | null;
}

export interface ActivityPage {
  items: ActivityView[];
  nextCursor: string | null;
}

/** An event ready to show: the sentence in pieces (some of them links) and the time already formatted. */
export interface FeedItem {
  id: string;
  actor: string;
  parts: { text: string; href?: string }[];
  when: string;
}
