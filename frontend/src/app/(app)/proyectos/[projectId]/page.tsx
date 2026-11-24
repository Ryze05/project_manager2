import Link from "next/link";
import { Badge } from "@/components/ui";
import { api, unwrap } from "@/lib/api";
import type { ProjectView } from "@/lib/types";
import styles from "../projects.module.css";

/** Temporary: header only. The board replaces the body in the next step. */
export default async function ProjectPage({
  params,
}: PageProps<"/proyectos/[projectId]">) {
  const { projectId } = await params;
  const project = await unwrap(await api<ProjectView>(`/projects/${projectId}`));

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
        <Badge tone={project.role === "OWNER" ? "accent" : "neutral"}>
          {project.role === "OWNER" ? "Propietario" : "Miembro"}
        </Badge>
      </header>
    </div>
  );
}
