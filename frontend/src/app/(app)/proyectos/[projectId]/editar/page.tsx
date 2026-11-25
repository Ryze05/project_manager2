import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfirmDelete } from "@/components/ConfirmDelete/ConfirmDelete";
import { Card } from "@/components/ui";
import { getLabels, getProject } from "@/lib/queries";
import { deleteProjectAction, updateProjectAction } from "../../actions";
import { ArchiveButton } from "../../ArchiveButton";
import { ProjectForm } from "../../ProjectForm";
import styles from "../../projects.module.css";
import { LabelManager } from "./LabelManager";

export const metadata = { title: "Editar proyecto · Gestor de proyectos" };

export default async function EditProjectPage({
  params,
}: PageProps<"/proyectos/[projectId]/editar">) {
  const { projectId } = await params;
  const [project, labels] = await Promise.all([getProject(projectId), getLabels(projectId)]);
  // Only the owner edits or deletes (the API enforces it too).
  if (project.role !== "OWNER") redirect(`/proyectos/${projectId}`);
  const archived = project.archivedAt !== null;

  return (
    <div className={styles.formPage}>
      <Link href={`/proyectos/${projectId}`} className={styles.back}>
        ← {project.name}
      </Link>
      <header className={styles.head}>
        <h1>Editar proyecto</h1>
      </header>
      <div className={styles.stack}>
        {archived ? (
          <Card>
            <h3>Proyecto archivado</h3>
            <p className={styles.dangerText}>
              Está en solo lectura: nadie puede cambiar tareas, comentarios, miembros ni etiquetas
              hasta que lo desarchives.
            </p>
            <ArchiveButton projectId={projectId} archived />
          </Card>
        ) : (
          <>
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
              <h3>Etiquetas</h3>
              <p className={styles.dangerText}>
                Cualquier miembro puede crear etiquetas al editar una tarea; renombrarlas o borrarlas
                es cosa del propietario.
              </p>
              <LabelManager projectId={projectId} labels={labels} />
            </Card>
            <Card>
              <h3>Archivar proyecto</h3>
              <p className={styles.dangerText}>
                Pasa a la pestaña «Archivados» y queda en solo lectura. Puedes desarchivarlo cuando
                quieras.
              </p>
              <ArchiveButton projectId={projectId} archived={false} />
            </Card>
          </>
        )}
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
