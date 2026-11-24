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
