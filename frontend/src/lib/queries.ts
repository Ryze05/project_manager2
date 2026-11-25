import "server-only";
import { cache } from "react";
import { api, unwrap } from "./api";
import type {
  ActivityPage,
  Board,
  CommentView,
  CurrentUser,
  LabelView,
  MemberView,
  MyInvitationView,
  MyTaskView,
  ProjectInvitationView,
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

/** `query` is the already-validated filter string of `lib/board-filters.ts` ("" or "?label=..."). */
export const getBoard = cache((projectId: string, query: string = "") =>
  api<Board>(`/projects/${projectId}/board${query}`).then(unwrap),
);

export const getLabels = cache((projectId: string) =>
  api<LabelView[]>(`/projects/${projectId}/labels`).then(unwrap),
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

/** Pending invitations of the project (owners only). */
export const getProjectInvitations = cache((projectId: string) =>
  api<ProjectInvitationView[]>(`/projects/${projectId}/invitations`).then(unwrap),
);

/** My pending invitations: the inbox page and the sidebar counter share this. */
export const getMyInvitations = cache(() =>
  api<MyInvitationView[]>("/me/invitations").then(unwrap),
);

/** Tasks assigned to the user. The sidebar counter and "mis tareas" share the default listing. */
export const getMyTasks = cache((includeDone: boolean) =>
  api<MyTaskView[]>(`/me/tasks?includeDone=${includeDone}`).then(unwrap),
);

/** A page of the history, newest first. `taskId` narrows it to one task; `cursor` asks for the older page. */
export const getActivity = cache(
  (projectId: string, taskId: string = "", limit: number = 50, actorId: string = "") => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (taskId) params.set("taskId", taskId);
  if (actorId) params.set("actorId", actorId);
  return api<ActivityPage>(`/projects/${projectId}/activity?${params}`).then(unwrap);
});
