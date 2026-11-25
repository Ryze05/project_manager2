import Link from "next/link";
import { Avatar, Badge, ButtonLink, Card, Segmented } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { getProjects } from "@/lib/queries";
import styles from "./projects.module.css";

export const metadata = { title: "Proyectos · Gestor de proyectos" };

export default async function ProjectsPage({ searchParams }: PageProps<"/proyectos">) {
  const showArchived = (await searchParams).archivados === "1";
  const all = await getProjects();
  const projects = all.filter((project) => Boolean(project.archivedAt) === showArchived);
  const archivedCount = all.filter((project) => project.archivedAt).length;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>Todos los proyectos en los que participas</p>
          <h1>Proyectos</h1>
        </div>
        <ButtonLink href="/proyectos/nuevo">Nuevo proyecto</ButtonLink>
      </header>

      {(archivedCount > 0 || showArchived) && (
        <div className={styles.tabs}>
          <Segmented
            label="Proyectos"
            options={[
              { label: "Activos", href: "/proyectos", active: !showArchived },
              { label: `Archivados (${archivedCount})`, href: "/proyectos?archivados=1", active: showArchived },
            ]}
          />
        </div>
      )}

      {projects.length === 0 ? (
        <div className={styles.empty}>
          {showArchived ? (
            <p>No tienes proyectos archivados.</p>
          ) : (
            <>
              <p>Todavía no tienes proyectos.</p>
              <Link href="/proyectos/nuevo">Crea el primero</Link>
            </>
          )}
        </div>
      ) : (
        <ul className={styles.grid}>
          {projects.map((project) => (
            <li key={project.id}>
              <Link href={`/proyectos/${project.id}`} className={styles.link}>
                <Card className={styles.card}>
                  <Avatar name={project.name} shape="project" size="lg" />
                  <div className={styles.body}>
                    <div className={styles.top}>
                      <h3>{project.name}</h3>
                      {project.archivedAt ? (
                        <Badge tone="outline">Archivado</Badge>
                      ) : (
                        <Badge tone={project.role === "OWNER" ? "accent" : "neutral"}>
                          {project.role === "OWNER" ? "Propietario" : "Miembro"}
                        </Badge>
                      )}
                    </div>
                    <p className={project.description ? styles.desc : styles.descEmpty}>
                      {project.description ?? "Sin descripción"}
                    </p>
                    <div className={styles.foot}>
                      <span>
                        {project.memberCount === 1
                          ? "Solo tú"
                          : `${project.memberCount} miembros`}
                      </span>
                      <span>Actualizado {timeAgo(project.updatedAt)}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
