import Link from "next/link";
import { Badge, ButtonLink } from "@/components/ui";
import { api, unwrap } from "@/lib/api";
import type { ProjectView } from "@/lib/types";
import styles from "../projects.module.css";

/** Temporary: header only. The board replaces the body in the next step. */
export default async function ProjectPage({
  params,
}: PageProps<"/proyectos/[projectId]">) {
  const { projectId } = await params;
  const project = await unwrap(await api<ProjectView>(`/projects/${projectId}`));
  const isOwner = project.role === "OWNER";

  return (
    <div className={styles.page}>
      <Link href="/proyectos" className={styles.back}>
        ← Proyectos
      </Link>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>{project.description ?? "Sin descripción"}</p>
          <h1>{project.name}</h1>
        </div>
        <div className={styles.actions}>
          <Badge tone={isOwner ? "accent" : "neutral"}>
            {isOwner ? "Propietario" : "Miembro"}
          </Badge>
          <ButtonLink href={`/proyectos/${projectId}/miembros`} variant="ghost">
            Miembros <span className={styles.count}>{project.memberCount}</span>
          </ButtonLink>
          {isOwner && (
            <ButtonLink href={`/proyectos/${projectId}/editar`} variant="ghost">
              Editar
            </ButtonLink>
          )}
        </div>
      </header>
    </div>
  );
}
