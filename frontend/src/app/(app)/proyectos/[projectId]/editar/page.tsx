import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfirmDelete } from "@/components/ConfirmDelete/ConfirmDelete";
import { Card } from "@/components/ui";
import { getProject } from "@/lib/queries";
import { deleteProjectAction, updateProjectAction } from "../../actions";
import { ProjectForm } from "../../ProjectForm";
import styles from "../../projects.module.css";

export const metadata = { title: "Editar proyecto · Gestor de proyectos" };

export default async function EditProjectPage({
  params,
}: PageProps<"/proyectos/[projectId]/editar">) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  // Only the owner edits or deletes (the API enforces it too).
  if (project.role !== "OWNER") redirect(`/proyectos/${projectId}`);

  return (
    <div className={styles.formPage}>
      <Link href={`/proyectos/${projectId}`} className={styles.back}>
        ← {project.name}
      </Link>
      <header className={styles.head}>
        <h1>Editar proyecto</h1>
      </header>
      <div className={styles.stack}>
        <Card>
          <ProjectForm
            action={updateProjectAction.bind(null, projectId)}
            submitLabel="Guardar cambios"
            pendingLabel="Guardando…"
            cancelHref={`/proyectos/${projectId}`}
            initial={{ name: project.name, description: project.description ?? "" }}
          />
        </Card>
        <Card>
          <h3>Eliminar proyecto</h3>
          <p className={styles.dangerText}>
            Se borrarán también sus tareas, subtareas y comentarios. No se puede deshacer.
          </p>
          <ConfirmDelete
            action={deleteProjectAction.bind(null, projectId)}
            label="Eliminar proyecto"
            title={`¿Eliminar «${project.name}»?`}
            description="Se borrará con todo su contenido para todos los miembros."
          />
        </Card>
      </div>
    </div>
  );
}
