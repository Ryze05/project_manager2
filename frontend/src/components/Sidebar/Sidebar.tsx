import { logoutAction } from "@/app/(auth)/actions";
import { Avatar } from "@/components/ui";
import type { CurrentUser, ProjectView } from "@/lib/types";
import { NavLink } from "./NavLink";
import styles from "./Sidebar.module.css";

const RECENT_COUNT = 3;

/** Side navigation: logo, sections, recent projects and the signed-in user. */
export function Sidebar({
  user,
  projects,
  pendingCount,
  invitationCount,
}: {
  user: CurrentUser;
  projects: ProjectView[];
  /** Tasks assigned to the user that are not done. */
  pendingCount: number;
  /** Invitations to projects waiting for an answer. */
  invitationCount: number;
}) {
  // The API already returns projects most recently updated first.
  const recent = projects.slice(0, RECENT_COUNT);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.logoMark}>N</span> Nombre
      </div>

      <nav className={styles.nav} aria-label="Principal">
        <NavLink href="/proyectos">Proyectos</NavLink>
        <NavLink href="/mis-tareas">
          Mis tareas
          {pendingCount > 0 && <span className={styles.pill}>{pendingCount}</span>}
        </NavLink>
        <NavLink href="/invitaciones">
          Invitaciones
          {invitationCount > 0 && <span className={styles.pill}>{invitationCount}</span>}
        </NavLink>
      </nav>

      {recent.length > 0 && (
        <div className={styles.recent}>
          <div className={styles.title}>Recientes</div>
          <nav className={styles.nav} aria-label="Proyectos recientes">
            {recent.map((project) => (
              <NavLink key={project.id} href={`/proyectos/${project.id}`} dot>
                {project.name}
              </NavLink>
            ))}
          </nav>
        </div>
      )}

      <div className={styles.me}>
        <Avatar name={user.name} me />
        <div className={styles.meText}>
          <span className={styles.meName}>{user.name}</span>
          <form action={logoutAction}>
            <button type="submit" className={styles.logout}>
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
