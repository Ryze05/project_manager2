# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

Not a git repo yet. Layout:
- `docs/especificaciones_gestor_proyectos_colaborativo.md` — the product spec (in Spanish); read it before implementing anything, it is the source of truth.
- `bd_docker/` — Docker Compose for Postgres + pgAdmin.
- `backend/` — NestJS API (level 1 in progress). Done so far: project scaffold, env config + validation, global app setup (prefix, pipes, CORS, Swagger), Prisma schema + initial migration, `PrismaService`. Not done yet: auth, projects/members, tasks, comments, "mis tareas" (the default `AppController` "Hello World" is still a placeholder).
- No front-end yet (planned: Next.js on port 3001; `FRONTEND_URL` defaults to `http://localhost:3001`).

## Product summary (from the spec)

Collaborative project manager: projects with members and roles, tasks/subtasks on a 3-column board (por hacer / en curso / hecha), comments, and a personal "mis tareas" view. A solo project is just a project with one member.

Planned stack: NestJS (TypeScript, one module per feature: auth, projects, tasks, comments) + Next.js/Tailwind front-end, REST API with JWT, PostgreSQL + Prisma, bcrypt, class-validator, Swagger. DB/ORM/front-end libs are marked "propuesta" (not yet confirmed).

Built in levels; do not start a level until the previous one works and is reviewed:
1. Core (build order: auth/projects/members → tasks & board → subtasks → comments → mis tareas; if time is short, cut from the end)
2. Added value (labels/filters, activity log, drag & drop with stored position, invitations, metrics, archiving, ownership transfer, refresh tokens…)
3. Extras (read-only role, notifications, realtime, attachments, e2e tests)

## Architecture and business rules that span modules

- **Data model: 5 entities** — User, Project, ProjectMember (composite key user+project, role owner/member), Task, Comment. Subtasks are Tasks with a nullable `parent` field (no separate table). All entities share the same ID type.
- **Validated in the service layer, not the DB:** assignee must be a project member; a subtask cannot have subtasks (one level only).
- **Subtask progress (e.g. 2/4) is computed from subtask states, never stored.**
- A task cannot be marked done while it has pending subtasks; creating/reopening a subtask under a done parent sets the parent back to "en curso"; the parent is never auto-completed.
- Level 1: a subtask cannot be moved to another parent nor can a task be converted to a subtask (level 2 lifts this).
- Level 1: exactly one owner per project; the owner cannot leave or be removed (only delete the project). Level 2 adds multiple owners/transfer.
- Removing a member leaves their tasks/subtasks unassigned. Deleting a task cascades to subtasks and comments; deleting a project cascades to everything.
- Non-members cannot see anything about a project. Members can add members only by email of already-registered users (clear error otherwise).
- Permissions: owner and member both create/edit/move tasks and comment; members delete only tasks/subtasks they created and only their own comments; owner deletes any task/comment; only owner manages members and edits/deletes the project. Comments are editable only by their author.
- Auth: password min 8 chars with one uppercase and one number; JWT valid 24h (level 1).
- Board: subtasks never appear as cards, only inside the parent; cards ordered by priority, then due date. "Mis tareas" is ordered by due date, shows pending + in-progress by default (toggle for done), and shows project and parent task for subtasks.
- Out of scope: nested subtasks, extra roles, external integrations, mobile app, checklists.

Note: the spec has a few level-1 vs level-2 differences (single vs multiple owners, no moving subtasks vs allowed) — implement the level-1 behavior first and keep the code open to the level-2 changes.

## Database environment (`bd_docker/`)

Docker Compose stack with two services:
- `postgres` (postgres:16-alpine, container `gestor_postgres`) — data in the `postgres_data` volume; has a `pg_isready` healthcheck.
- `pgadmin` (dpage/pgadmin4, container `gestor_pgadmin`) — depends on postgres being healthy; data in `pgadmin_data` volume.

Configuration comes from `bd_docker/.env` (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `PGADMIN_EMAIL`, `PGADMIN_PASSWORD`, `PGADMIN_PORT`). Defaults: Postgres on 5432, database `gestor`, pgAdmin on 5050. `.env` holds credentials, so don't print or commit it.

Commands (run from `bd_docker/`):
- `docker compose up -d` — start the stack
- `docker compose down` — stop (add `-v` to also wipe the database volumes)
- `docker compose exec postgres psql -U admin -d gestor` — open a SQL shell

## Backend (`backend/`)

pnpm project, NestJS 12, **ESM** (`"type": "module"`): relative imports must end in `.js`, no `__dirname` (use `import.meta.dirname`). Tests use **Vitest** (`vi.fn()`, not Jest); lint is **oxlint**. `AGENTS.md` in `backend/` has NestJS-version notes from the CLI.

Commands (run from `backend/`; the DB stack must be up for anything touching Postgres):
- `pnpm start:dev` — run with watch; `pnpm build` then `node --env-file=.env dist/main.js` to run the build
- `pnpm test` — unit tests; single file: `pnpm test src/path/file.spec.ts`; `pnpm test:e2e` — e2e (separate vitest config)
- `pnpm lint`, `pnpm format`
- `pnpm db:migrate` (= `prisma migrate dev`), `pnpm exec prisma generate`, `pnpm db:studio`

Setup facts that are easy to miss:
- **Env**: `backend/.env` (gitignored; `.env.example` is the template) holds `NODE_ENV, PORT, FRONTEND_URL, DATABASE_URL, JWT_SECRET (>=32 chars, generated with `openssl rand -hex 32`), JWT_EXPIRES_IN`. Validated at boot by a **Joi** schema (`src/config/env.validation.ts`) passed to the global `ConfigModule` as `validationSchema`; the app refuses to start on invalid values. In `@nestjs/config` v12 `validationOptions` does not accept Joi options, so `abortEarly: false` lives on the schema itself. Read config through `ConfigService<EnvironmentVariables, true>`.
- **Bootstrap (`src/main.ts`)**: global prefix `api/v1`, global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`, implicit conversion), CORS limited to `FRONTEND_URL`, shutdown hooks, Swagger UI at `/api/docs` (outside the prefix, Bearer auth declared). DTOs use class-validator / class-transformer.
- **Prisma 7**: config in `prisma.config.ts` (loads `.env` via `dotenv`), schema in `prisma/schema.prisma`, migrations in `prisma/migrations/`. The client is generated into `src/generated/prisma` (gitignored; `postinstall` runs `prisma generate`) — it must live under `src/` because `tsconfig.build.json` sets `rootDir: ./src`. Import it as `.../generated/prisma/client.js`. `PrismaService` (global `PrismaModule`) extends `PrismaClient` with the `@prisma/adapter-pg` driver adapter and connects on module init; inject it instead of instantiating clients. Keep `prisma` CLI and `@prisma/client` on the same version (pinned `7.10.1`).
- **bcrypt** is a native module: its build script is allowed through `pnpm.onlyBuiltDependencies` in `package.json`.

### Prisma schema decisions

- UUID ids everywhere; enums `ProjectRole` (OWNER/MEMBER), `TaskStatus` (TODO/IN_PROGRESS/DONE), `TaskPriority` (LOW/MEDIUM/HIGH, default MEDIUM).
- **Subtasks are a self-reference on `Task`** (`parentId` -> `Task.id`, relations `parent`/`subtasks`), deliberately not a separate table (decided over a separate `Subtask` table: same fields, one `Comment.taskId`, simple "mis tareas" query, level-2 move/convert is just changing `parentId`). Board queries must filter `parentId: null`.
- `Comment.editedAt` is null until edited.
- Cascades: project -> members/tasks; task -> subtasks/comments. `Task.assignee` is `SetNull` on user delete; `Task.creator` and `Comment.author` are `Restrict`.
- **Must be enforced in services, not the DB**: assignee is a member of the task's project (and removing a member must null their assignments in that project manually, since `assigneeId` points at `User`); a single owner per project; subtasks cannot have subtasks; a subtask copies `projectId` from its parent.
- Level-2 fields (archivedAt, task position, labels, activity log) are not in the schema yet; add them by migration.
