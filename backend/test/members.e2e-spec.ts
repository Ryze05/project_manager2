import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { api, createTestApp } from './support/app.js';
import {
  addMember,
  createSubtask,
  createTask,
  createTeam,
} from './support/fixtures.js';

describe('Members (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /projects/:projectId/members', () => {
    it('lists the owner first, then the rest by name; visible to members', async () => {
      const { owner, member, outsider, projectId } = await createTeam(app);
      await addMember(app, owner, projectId, outsider);

      const res = await api(app, member)
        .get(`/projects/${projectId}/members`)
        .expect(200);

      expect(
        res.body.map(
          (m: { name: string; role: string }) => `${m.name}:${m.role}`,
        ),
      ).toEqual(['Marta:OWNER', 'Lucia:MEMBER', 'Pablo:MEMBER']);
      expect(res.body[0]).toEqual({
        id: owner.id,
        name: owner.name,
        email: owner.email,
        role: 'OWNER',
      });
    });

    it('answers 404 to non-members', async () => {
      const { outsider, projectId } = await createTeam(app);

      await api(app, outsider)
        .get(`/projects/${projectId}/members`)
        .expect(404);
    });
  });

  describe('DELETE /projects/:projectId/members/:userId', () => {
    it('removes a member, who then loses all access to the project', async () => {
      const { owner, member, projectId } = await createTeam(app);

      await api(app, owner)
        .delete(`/projects/${projectId}/members/${member.id}`)
        .expect(204);

      await api(app, member).get(`/projects/${projectId}`).expect(404);
      await api(app, member).get(`/projects/${projectId}/board`).expect(404);
      const mine = await api(app, member).get('/projects').expect(200);
      expect(mine.body).toEqual([]);
    });

    it("leaves the removed member's tasks and subtasks unassigned, and only theirs", async () => {
      const { owner, member, projectId } = await createTeam(app);
      const theirs = await createTask(app, owner, projectId, {
        title: 'De Pablo',
        assigneeId: member.id,
      });
      const mine = await createTask(app, owner, projectId, {
        title: 'De Marta',
        assigneeId: owner.id,
      });
      const subtask = await createSubtask(app, owner, projectId, mine.id, {
        title: 'Sub de Pablo',
        assigneeId: member.id,
      });

      await api(app, owner)
        .delete(`/projects/${projectId}/members/${member.id}`)
        .expect(204);

      const assigneeOf = async (taskId: string) =>
        (
          await api(app, owner)
            .get(`/projects/${projectId}/tasks/${taskId}`)
            .expect(200)
        ).body.assignee;
      expect(await assigneeOf(theirs.id)).toBeNull();
      expect(await assigneeOf(subtask.id)).toBeNull();
      expect(await assigneeOf(mine.id)).toMatchObject({ id: owner.id });
    });

    it('does not unassign tasks of the same user in other projects', async () => {
      const { owner, member, projectId } = await createTeam(app);
      const other = await api(app, owner)
        .post('/projects', { name: 'Otro' })
        .expect(201);
      await addMember(app, owner, other.body.id, member);
      const elsewhere = await createTask(app, owner, other.body.id, {
        title: 'En otro proyecto',
        assigneeId: member.id,
      });

      await api(app, owner)
        .delete(`/projects/${projectId}/members/${member.id}`)
        .expect(204);

      const res = await api(app, owner)
        .get(`/projects/${other.body.id}/tasks/${elsewhere.id}`)
        .expect(200);
      expect(res.body.assignee).toMatchObject({ id: member.id });
    });

    it('never removes the owner, not even by themselves (403)', async () => {
      const { owner, projectId } = await createTeam(app);

      const res = await api(app, owner)
        .delete(`/projects/${projectId}/members/${owner.id}`)
        .expect(403);

      expect(res.body.message).toMatch(/^Un propietario no puede ser quitado/);
      expect(await prisma.projectMember.count({ where: { projectId } })).toBe(
        2,
      );
    });

    it('answers 404 for someone who is not a member and 400 for a malformed id', async () => {
      const { owner, outsider, projectId } = await createTeam(app);

      await api(app, owner)
        .delete(`/projects/${projectId}/members/${outsider.id}`)
        .expect(404);
      await api(app, owner)
        .delete(`/projects/${projectId}/members/abc`)
        .expect(400);
    });

    it('is owner-only: a member gets 403, an outsider 404', async () => {
      const { owner, member, outsider, projectId } = await createTeam(app);

      await api(app, member)
        .delete(`/projects/${projectId}/members/${owner.id}`)
        .expect(403);
      await api(app, outsider)
        .delete(`/projects/${projectId}/members/${member.id}`)
        .expect(404);
    });
  });
});
