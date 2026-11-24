import "server-only";
import { cache } from "react";
import { api, unwrap } from "./api";
import type {
  Board,
  CommentView,
  CurrentUser,
  MemberView,
  MyTaskView,
  ProjectView,
  TaskView,
} from "./types";

/**
 * Reads for Server Components. `cache()` deduplicates them within one request,
 * so the layout and the page can both ask for the same thing (the user, a
 * project...) and it is fetched once. Each one returns the data or leaves the
 * page (see `unwrap`).
 */
export const getMe = cache(() => api<CurrentUser>("/auth/me").then(unwrap));

export const getProjects = cache(() => api<ProjectView[]>("/projects").then(unwrap));

export const getProject = cache((projectId: string) =>
  api<ProjectView>(`/projects/${projectId}`).then(unwrap),
);

export const getMembers = cache((projectId: string) =>
  api<MemberView[]>(`/projects/${projectId}/members`).then(unwrap),
);

export const getBoard = cache((projectId: string) =>
  api<Board>(`/projects/${projectId}/board`).then(unwrap),
);

export const getTask = cache((projectId: string, taskId: string) =>
  api<TaskView>(`/projects/${projectId}/tasks/${taskId}`).then(unwrap),
);

export const getSubtasks = cache((projectId: string, taskId: string) =>
  api<TaskView[]>(`/projects/${projectId}/tasks/${taskId}/subtasks`).then(unwrap),
);

export const getComments = cache((projectId: string, taskId: string) =>
  api<CommentView[]>(`/projects/${projectId}/tasks/${taskId}/comments`).then(unwrap),
);

/** Tasks assigned to the user. The sidebar counter and "mis tareas" share the default listing. */
export const getMyTasks = cache((includeDone: boolean) =>
  api<MyTaskView[]>(`/me/tasks?includeDone=${includeDone}`).then(unwrap),
);
