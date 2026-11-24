import Link from "next/link";
import { Avatar, Badge, Card } from "@/components/ui";
import { api, unwrap } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { ProjectView } from "@/lib/types";
import styles from "./projects.module.css";

export const metadata = { title: "Proyectos · Gestor de proyectos" };

export default async function ProjectsPage() {
  const projects = await unwrap(await api<ProjectView[]>("/projects"));

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>Todos los proyectos en los que participas</p>
          <h1>Proyectos</h1>
        </div>
        <Link href="/proyectos/nuevo" className={styles.cta}>
          Nuevo proyecto
        </Link>
      </header>

      {projects.length === 0 ? (
        <div className={styles.empty}>
          <p>Todavía no tienes proyectos.</p>
          <Link href="/proyectos/nuevo">Crea el primero</Link>
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
                      <Badge tone={project.role === "OWNER" ? "accent" : "neutral"}>
                        {project.role === "OWNER" ? "Propietario" : "Miembro"}
                      </Badge>
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
