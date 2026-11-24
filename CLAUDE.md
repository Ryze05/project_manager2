# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

Git repo (branch `main`, root `.gitignore` excludes `.env`, `node_modules`, `dist`, generated Prisma client). Layout:
- `docs/especificaciones_gestor_proyectos_colaborativo.md` — the product spec (in Spanish); read it before implementing anything, it is the source of truth.
- `bd_docker/` — Docker Compose for Postgres + pgAdmin.
- `backend/` — NestJS API (level 1 in progress). Done so far: project scaffold, env config + validation, global app setup (prefix, pipes, CORS, Swagger), Prisma schema + initial migration, `PrismaService`, `UsersModule`, a global `PrismaExceptionFilter`, and auth (`src/auth/`: register/login, JWT strategy, global `JwtAuthGuard` with `@Public()` opt-out, `@CurrentUser()`). `MembersModule` (membership checks + member list/add/remove), `ProjectsModule` (project CRUD), `TasksModule` (tasks, board and subtasks) and `HealthModule`. `CommentsModule` (comments on tasks and subtasks). `MyTasksModule` ("mis tareas"). Level 1 is complete. The scaffold's "Hello World" controller was removed, so there is no root route. Automated e2e tests exist (`backend/test/`, see "E2E tests").
- `frontend/` — Next.js front-end (level 1 in progress, see "Frontend"). Done so far: skeleton (server-side API client, session cookie helpers), design tokens and the base UI components (`src/components/ui/`); no real screen yet.

## Product summary (from the spec)

Collaborative project manager: projects with members and roles, tasks/subtasks on a 3-column board (por hacer / en curso / hecha), comments, and a personal "mis tareas" view. A solo project is just a project with one member.

Planned stack: NestJS (TypeScript, one module per feature: auth, projects, tasks, comments) + Next.js front-end styled with CSS Modules (Tailwind was proposed in the spec and rejected), REST API with JWT, PostgreSQL + Prisma, bcrypt, class-validator, Swagger. DB/ORM/front-end libs are marked "propuesta" (not yet confirmed).

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

## Frontend (`frontend/`)

pnpm project, **Next.js 16** (App Router, `src/`), React 19, TypeScript, **CSS Modules** (no Tailwind), zod. Its `AGENTS.md` says this Next.js has breaking changes: read the guides in `frontend/node_modules/next/dist/docs/` before writing Next code. Facts already learned from them: `middleware` is now **`proxy.ts`**; `cookies()` is **async** and can only set/delete cookies from a Server Action or Route Handler.

Commands (from `frontend/`): `pnpm dev` (port 3001), `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm typecheck`. Env: `frontend/.env` (gitignored; `.env.example` is the template) holds `API_URL` (default `http://localhost:3000/api/v1`), server-side only.

- **The browser never talks to the API.** Everything goes through `src/lib/api.ts` (`import "server-only"`), called from Server Components and Server Actions. It adds the Bearer token, never throws for HTTP or network errors and returns `{ ok, status, ... }` (status 0 = API unreachable). Nest validation errors (`message` as an array) are joined into one string.
- **Session = the API's JWT in an httpOnly cookie** (`src/lib/session.ts`: `getToken`, `setToken`, `clearToken`; `sameSite: lax`, `secure` in production, 24h like the JWT). Client JS never sees it. Redirecting to the login when there is no session is done in `proxy.ts` (not written yet).
- **Forms:** Server Actions + `useActionState`, validated with zod in the action. zod only mirrors simple rules for instant feedback; the API stays the source of truth and its errors are always shown.
- **`cacheComponents` / `partialPrefetching` are off** on purpose: the scaffold enabled them, but nearly everything is per-user and must be fresh, and they force `<Suspense>` around every `cookies()` read. Fetches use `cache: "no-store"`.
- **Styling and design system:** the agreed look is saved as an 8-screen HTML prototype in `docs/diseno/sistema-de-diseno.html` (Sistema, Acceso, Inicio, Proyectos, Tablero, Detalle, Mis tareas, Miembros); its `:root` is what `src/app/globals.css` holds. Light only, no dark mode. Rules: 3 colour families (warm neutrals, one purple accent `--accent`, terracotta `--danger` only for overdue / high priority / errors); `--accent-soft` is the single purple tint for hover, selection, initials and role, `--accent-mid` for counters over it; 4 px spacing scale (`--s1..--s7`, page 32, card 24, gap 16, block 32; 16 on mobile); radii 8/12/20/pill; one shadow; 7 font sizes, 3 weights. CSS Modules must only use these variables (no raw colours, spaces or radii). The prototype may change as screens get built; keep both in sync.
- **Base components** (`src/components/ui/`, import from `@/components/ui`): `Button` (primary/ghost/danger/link), `Card`, `Badge` (neutral/accent/danger/outline, optional dot), `Avatar` (initial; person or project; one colour variant), `Input` (label/hint/error), `ProgressBar`. `/componentes` is a temporary page showing them; delete it when real screens exist. Sidebar, segmented control and switch are in the prototype but not built yet (build them with the first screen that needs them).
- Build order (same spirit as the backend): skeleton -> tokens + base components -> register/login + redirect -> projects -> members -> board (move between columns) -> task detail with subtasks -> comments -> mis tareas. Drag & drop and subtask initials on cards are level 2 and wait for the front-end to exist.

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
- `pnpm test` — unit tests; single file: `pnpm test src/path/file.spec.ts`; `pnpm test:e2e` — e2e against a real Postgres (separate vitest config; needs the DB stack up, see "E2E tests")
- `pnpm lint`, `pnpm format`
- `pnpm db:migrate` (= `prisma migrate dev`), `pnpm exec prisma generate`, `pnpm db:studio`

Setup facts that are easy to miss:
- **Env**: `backend/.env` (gitignored; `.env.example` is the template) holds `NODE_ENV, PORT, FRONTEND_URL, DATABASE_URL, JWT_SECRET (>=32 chars, generated with `openssl rand -hex 32`), JWT_EXPIRES_IN`. Validated at boot by a **Joi** schema (`src/config/env.validation.ts`) passed to the global `ConfigModule` as `validationSchema`; the app refuses to start on invalid values. In `@nestjs/config` v12 `validationOptions` does not accept Joi options, so `abortEarly: false` lives on the schema itself. Read config through `ConfigService<EnvironmentVariables, true>`.
- **Bootstrap (`src/main.ts`)**: global prefix `api/v1`, global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`, implicit conversion), CORS limited to `FRONTEND_URL`, shutdown hooks, Swagger UI at `/api/docs` (outside the prefix, Bearer auth declared). DTOs use class-validator / class-transformer.
- **Prisma 7**: config in `prisma.config.ts` (loads `.env` via `dotenv`), schema in `prisma/schema.prisma`, migrations in `prisma/migrations/`. The client is generated into `src/generated/prisma` (gitignored; `postinstall` runs `prisma generate`) — it must live under `src/` because `tsconfig.build.json` sets `rootDir: ./src`. Import it as `.../generated/prisma/client.js`. `PrismaService` (global `PrismaModule`) extends `PrismaClient` with the `@prisma/adapter-pg` driver adapter and connects on module init; inject it instead of instantiating clients. Keep `prisma` CLI and `@prisma/client` on the same version (pinned `7.10.1`).
- **bcrypt** is a native module: its build script is allowed through `pnpm.onlyBuiltDependencies` in `package.json`.

### Auth

- `JwtAuthGuard` is registered globally (`APP_GUARD` in `AuthModule`): **every route requires a Bearer JWT unless marked `@Public()`** (only `POST /auth/register` and `POST /auth/login` are public). New routes are protected by default; a new open route needs `@Public()`.
- `JwtStrategy.validate` loads the user by `sub` on each request (so a deleted user's token stops working) and sets `request.user = { id, name, email }`; read it with `@CurrentUser()`.
- `AuthService` hashes passwords with bcrypt (10 rounds) before calling `UsersService.create`, which stores whatever it receives. Wrong email and wrong password return the same 401 message. Responses never include `password`.
- Signing secret and expiry come from `JWT_SECRET` / `JWT_EXPIRES_IN` via `JwtModule.registerAsync` (the strategy reads the same secret to verify).
- Password rule lives in a single `@Matches` in `RegisterDto` (two `@Matches` on one property lose a message, since class-validator keys errors by rule type).
- `GET /auth/me` is not in the spec. It is kept on purpose until the front-end exists (it may use it to validate a stored token on reload); revisit then.
- Names (`RegisterDto.name`, `CreateProjectDto.name`) are trimmed with a `@Transform` in the DTO, before `@IsNotEmpty()` runs, so a whitespace-only name is rejected. Services assume the DTO already trimmed. Because of the global `enableImplicitConversion`, a number sent for a string field (e.g. `"name": 123`) is accepted and stored as `"123"`; this was reviewed and left as is.

### Health

`GET /api/v1/health` (`src/health/`, `@Public()`) runs `SELECT 1` through Prisma: 200 `{status:"ok",database:"up"}`, or 503 `{status:"error",database:"down"}` with the real error only in the server log. No `@nestjs/terminus`. Use it as the API healthcheck when the API gets containerized.

### Projects and members

- **Dependency direction: `ProjectsModule` → `MembersModule` → `UsersModule`**, never the reverse. `MembersService` owns the `ProjectMember` table and exports `requireMember(projectId, userId)` / `requireOwner(...)`; both return the membership (so callers get the `role` for free) and throw. Tasks and comments should import `MembersModule` for the same checks instead of querying memberships themselves.
- **Non-members get 404, not 403** (`requireMember`), so a project's existence is not revealed. A plain member trying an owner-only action gets 403 (`requireOwner`).
- Routes: `/projects` (create, list mine, get, patch, delete) and `/projects/:projectId/members` (list, add by email, delete `:userId`; add/remove are owner-only). Every project response is a `ProjectView` (`role` of the caller + `memberCount`); members are flattened to `{ id, name, email, role }`.
- `ProjectsService.create` creates the project and its OWNER membership in one nested Prisma create (atomic, no dependency on `MembersService`).
- `MembersService.remove` unassigns that user's tasks and subtasks in the project and deletes the membership in one `$transaction` (`Task.assigneeId` points at `User`, so the DB does not do it). The owner cannot be removed (403), which also covers "owner cannot leave"; there is no separate leave endpoint.
- Emails are matched lowercased/trimmed in `UsersService`, but `AddMemberDto` uses `@IsEmail`, which rejects surrounding whitespace (400).
- Unit tests mock Prisma; the Prisma queries (ordering by role, `_count`, composite key `userId_projectId`, the transaction, cascades) are covered by the e2e tests (`backend/test/members.e2e-spec.ts`, `projects.e2e-spec.ts`).

### Tasks and board

- Routes live under the project: `GET /projects/:projectId/board`, `POST /projects/:projectId/tasks`, and `GET|PATCH|DELETE /projects/:projectId/tasks/:taskId`. `TasksModule` imports `MembersModule`; every method starts with `requireMember`, and lookups are scoped by `projectId` (a task id from another project is a 404).
- **`GET/PATCH/DELETE .../tasks/:taskId` serve tasks and subtasks alike** (both are `Task` rows); the response carries `parentId` (null for a regular task). Subtask creation and listing are separate: `POST|GET /projects/:projectId/tasks/:taskId/subtasks` (listing is oldest first; a subtask has its own assignee and copies `projectId` from its parent). Neither DTO has `parentId` and the global pipe forbids unknown fields, so a subtask cannot be moved nor a task converted (level 1). Moving a card between columns is a `PATCH` of `status`.
- Board = three columns (`TODO`, `IN_PROGRESS`, `DONE`, always present), only `parentId: null` tasks, ordered by priority (HIGH first; relies on the Postgres enum order LOW < MEDIUM < HIGH), then due date (none last), then creation. Each card has `subtaskProgress {done, total}` computed from the subtasks.
- **`null` vs `undefined` in updates:** `description`, `dueDate` and `assigneeId` accept `null` to clear them; omitted means untouched. `title`, `priority` and `status` reject `null` (400). `@IsOptional()` lets `null` through, so non-nullable fields use `@ValidateIf(value !== undefined)` instead, and `UpdateTaskDto` redeclares them (`PartialType` would add `@IsOptional()` back).
- An assignee must be a project member (`MembersService.isMember`, non-throwing) or the request gets a 400. Delete: owner deletes any task, a member only the ones they created (403 otherwise).
- **Subtask rules live in `TasksService` (one service, same table):** creating a subtask under a subtask is a 400 ("Una subtarea no puede tener subtareas"); `PATCH status: DONE` on a task with any subtask not DONE (including IN_PROGRESS) is a **409** (the request is well-formed, the task's state conflicts); creating a subtask under a DONE parent, or reopening a DONE subtask (DONE -> any other status) while its parent is DONE, sets the parent to IN_PROGRESS **in the same interactive `$transaction`**. The parent is never completed automatically, and deleting subtasks never changes the parent. `update` always runs inside a `$transaction` (tests mock it by calling the callback with the same task mocks). Validation (assignee, level, 409) happens before the transaction, so a rejected request leaves the parent untouched. Rollback itself was checked once against Postgres with the `pg` adapter (a throw, and a real FK error P2003, after the parent update leave the parent as it was and create no subtask); concurrent requests are not guarded beyond that (read committed).

### Comments

- Routes: `POST|GET /projects/:projectId/tasks/:taskId/comments` and `PATCH|DELETE .../comments/:commentId`. They serve tasks and subtasks alike (both are `Task` rows). `CommentsModule` imports `MembersModule`; the task is checked with Prisma directly (no dependency on `TasksModule`).
- Check order in every method: membership (404 for outsiders) -> task belongs to the project (404) -> comment belongs to that task (404) -> permission (403). A comment id from another task or project is a 404.
- **Edit: author only, not even the owner (403).** Every edit sets `editedAt` (null until then) and keeps `createdAt`. **Delete: author, or the owner for any comment** (403 for another member).
- `content` is trimmed in the DTO, required, max 2000. `UpdateCommentDto` extends the create one (no `PartialType`: the text is always required). The thread is oldest first, no pagination. Responses carry `author {id, name, email}` and no `authorId`.
- Removing a member keeps their comments (history); `Comment.author` is `Restrict`, so deleting a user with comments is blocked by the DB.
- Covered by `comments.service.spec.ts` and `test/comments.e2e-spec.ts`, checked with mutations (owner editing, member deleting, missing task/project scoping, `editedAt`, thread order).

### Mis tareas

- `GET /api/v1/me/tasks?includeDone=true|false` (`src/my-tasks/`). Read-only, no dependency on `TasksModule` (it reuses its exported `taskInclude`/`toView` and queries Prisma directly).
- Returns tasks **and subtasks** assigned to the caller, in projects where they are still a member (the membership filter is defence in depth: removing a member already unassigns their tasks; a dedicated e2e deletes the membership directly to cover it). Each item is a `TaskView` plus `project {id, name}` and `parent {id, title} | null`.
- Default = TODO + IN_PROGRESS; `includeDone=true` adds DONE. Order: due date (none last), then priority (HIGH first), then creation. No pagination, no other filters (level 2).
- **`includeDone` is mapped by hand** in `MyTasksQueryDto`: with the global `enableImplicitConversion`, the string `"false"` would become `true`. Only `true`/`false` are accepted, anything else is 400 (covered by a DTO spec and an e2e).

### E2E tests

`pnpm test:e2e` runs `backend/test/*.e2e-spec.ts` (supertest against the real `AppModule`, same global setup as `main.ts` through `configureApp()` in `src/app.setup.ts`; no Swagger). Needs the Postgres container up and a `backend/.env` (only its `DATABASE_URL` is read).

- **Separate database, never the dev one.** `test/support/test-database.ts` derives the URL from `DATABASE_URL` by appending `_test` to the database name (`gestor` -> `gestor_test`), or uses `TEST_DATABASE_URL`. It **refuses any name that does not end in `_test`**, because the setup truncates every table.
- `test/global-setup.ts` runs once before everything: creates the database if missing (with `pg`), applies `prisma migrate deploy`, and truncates all tables except `_prisma_migrations`. It does **not** use `prisma migrate reset`: Prisma blocks destructive commands when it detects an AI agent, and that guard must not be bypassed. Data from the last run stays in `gestor_test` afterwards (handy to debug a failure) and is wiped at the next start.
- `vitest.config.e2e.ts` injects the app's env (`DATABASE_URL` of the test DB, a fixed fake `JWT_SECRET`, `FRONTEND_URL`...), which wins over `.env`, and sets `fileParallelism: false` (one shared database; files run one after another).
- Tests create their own data with unique emails and never depend on each other. Helpers: `test/support/app.ts` (`createTestApp`, `registerUser`, `api(app, user).get/post/patch/delete`, paths relative to `/api/v1`) and `test/support/fixtures.ts` (`createTeam` = project + owner + member + outsider, `createTask`, `createSubtask`).
- Decorators/DI work under vitest with Vite 8 as configured; no SWC plugin was needed.
- The suite was checked with mutations (inverting the board order, removing the 409 rule, allowing the owner to be removed, skipping the user check in `JwtStrategy`): each made exactly the relevant test fail. When adding a rule, prefer a test that would fail if the rule were removed.
- Not covered: concurrent requests, forced mid-transaction failures through the API (the rollback itself was checked once directly against Prisma), and load.

### Prisma schema decisions

- UUID ids everywhere; enums `ProjectRole` (OWNER/MEMBER), `TaskStatus` (TODO/IN_PROGRESS/DONE), `TaskPriority` (LOW/MEDIUM/HIGH, default MEDIUM).
- **Subtasks are a self-reference on `Task`** (`parentId` -> `Task.id`, relations `parent`/`subtasks`), deliberately not a separate table (decided over a separate `Subtask` table: same fields, one `Comment.taskId`, simple "mis tareas" query, level-2 move/convert is just changing `parentId`). Board queries must filter `parentId: null`.
- `Comment.editedAt` is null until edited.
- Cascades: project -> members/tasks; task -> subtasks/comments. `Task.assignee` is `SetNull` on user delete; `Task.creator` and `Comment.author` are `Restrict`.
- **Must be enforced in services, not the DB**: assignee is a member of the task's project (and removing a member must null their assignments in that project manually, since `assigneeId` points at `User`); a single owner per project; subtasks cannot have subtasks; a subtask copies `projectId` from its parent.
- Level-2 fields (archivedAt, task position, labels, activity log) are not in the schema yet; add them by migration.
