import Link from "next/link";
import { Card } from "@/components/ui";
import { AuthHeader } from "../AuthHeader";
import styles from "../auth.module.css";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Inicia sesión" };

export default function LoginPage() {
  return (
    <Card className={styles.card}>
      <AuthHeader
        title="Inicia sesión"
        subtitle="Entra para ver tus proyectos y tareas."
      />
      <LoginForm />
      <p className={styles.switch}>
        ¿No tienes cuenta? <Link href="/registro">Regístrate</Link>
      </p>
    </Card>
  );
}
