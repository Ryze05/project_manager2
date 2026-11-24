import { api } from "@/lib/api";
import styles from "./page.module.css";

/** Temporary home: proves the front-end reaches the API. Replaced by the login. */
export default async function Home() {
  const health = await api<{ status: string; database: string }>("/health", {
    auth: false,
  });

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1>Gestor de proyectos</h1>
        {health.ok ? (
          <p className={styles.ok}>
            API conectada (base de datos: {health.data.database})
          </p>
        ) : (
          <p className={styles.error}>API no disponible: {health.message}</p>
        )}
      </div>
    </main>
  );
}
