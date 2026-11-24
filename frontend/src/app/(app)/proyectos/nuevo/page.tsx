import { Card } from "@/components/ui";
import styles from "../projects.module.css";
import { NewProjectForm } from "./NewProjectForm";

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
        <NewProjectForm />
      </Card>
    </div>
  );
}
