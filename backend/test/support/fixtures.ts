import type { INestApplication } from '@nestjs/common';
import { api, registerUser, type TestUser } from './app.js';

export interface Team {
  owner: TestUser;
  member: TestUser;
  /** Registered, but not part of the project. */
  outsider: TestUser;
  projectId: string;
}

/** A project owned by `owner`, with `member` added, plus an `outsider`. */
export async function createTeam(app: INestApplication): Promise<Team> {
  const owner = await registerUser(app, 'Marta');
  const member = await registerUser(app, 'Pablo');
  const outsider = await registerUser(app, 'Lucia');

  const project = await api(app, owner)
    .post('/projects', { name: 'Proyecto' })
    .expect(201);
  const projectId = project.body.id as string;
  await api(app, owner)
    .post(`/projects/${projectId}/members`, { email: member.email })
    .expect(201);

  return { owner, member, outsider, projectId };
}

/** Creates a task through the API and returns its view. */
export async function createTask(
  app: INestApplication,
  user: TestUser,
  projectId: string,
  body: object,
) {
  const res = await api(app, user)
    .post(`/projects/${projectId}/tasks`, body)
    .expect(201);
  return res.body as { id: string; title: string; [key: string]: unknown };
}

/** Writes a comment through the API and returns its view. */
export async function createComment(
  app: INestApplication,
  user: TestUser,
  projectId: string,
  taskId: string,
  content: string,
) {
  const res = await api(app, user)
    .post(`/projects/${projectId}/tasks/${taskId}/comments`, { content })
    .expect(201);
  return res.body as {
    id: string;
    content: string;
    createdAt: string;
    editedAt: string | null;
    [key: string]: unknown;
  };
}

/** Creates a subtask through the API and returns its view. */
export async function createSubtask(
  app: INestApplication,
  user: TestUser,
  projectId: string,
  parentId: string,
  body: object,
) {
  const res = await api(app, user)
    .post(`/projects/${projectId}/tasks/${parentId}/subtasks`, body)
    .expect(201);
  return res.body as { id: string; title: string; [key: string]: unknown };
}
