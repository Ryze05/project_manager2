import { Card } from "@/components/ui";
import { createProjectAction } from "../actions";
import { ProjectForm } from "../ProjectForm";
import styles from "../projects.module.css";

export const metadata = { title: "Nuevo proyecto · Gestor de proyectos" };

export default function NewProjectPage() {
  return (
    <div className={styles.formPage}>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>Serás el propietario</p>
          <h1>Nuevo proyecto</h1>
        </div>
      </header>
      <Card>
        <ProjectForm
          action={createProjectAction}
          submitLabel="Crear proyecto"
          pendingLabel="Creando…"
          cancelHref="/proyectos"
        />
      </Card>
    </div>
  );
}
