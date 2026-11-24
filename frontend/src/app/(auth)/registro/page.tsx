import Link from "next/link";
import { Card } from "@/components/ui";
import { AuthHeader } from "../AuthHeader";
import styles from "../auth.module.css";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Crea tu cuenta" };

export default function RegisterPage() {
  return (
    <Card className={styles.card}>
      <AuthHeader
        title="Crea tu cuenta"
        subtitle="Empieza a organizar tus proyectos y tareas."
      />
      <RegisterForm />
      <p className={styles.switch}>
        ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
      </p>
    </Card>
  );
}
