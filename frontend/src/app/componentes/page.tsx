import { Avatar, Badge, Button, Card, Input, PasswordInput, ProgressBar } from "@/components/ui";
import styles from "./page.module.css";

/** Temporary page to see the base components together. Removed once real screens exist. */
export default function Componentes() {
  return (
    <main className={styles.page}>
      <h1>Componentes base</h1>
      <Card className={styles.stack}>
        <h3>Botones</h3>
        <div className={styles.row}>
          <Button>Principal</Button>
          <Button variant="ghost">Secundario</Button>
          <Button variant="danger">Quitar</Button>
          <Button variant="link">Enlace</Button>
          <Button disabled>Desactivado</Button>
        </div>
        <h3>Etiquetas</h3>
        <div className={styles.row}>
          <Badge tone="accent">Propietario</Badge>
          <Badge>Miembro</Badge>
          <Badge tone="danger" dot>Alta</Badge>
          <Badge dot>Media</Badge>
          <Badge tone="outline" dot>Baja</Badge>
        </div>
        <h3>Avatares</h3>
        <div className={styles.row}>
          <Avatar name="Pablo" />
          <Avatar name="Marta" me />
          <Avatar name="Entrenamientos" shape="project" />
          <Avatar name="Entrenamientos" shape="project" size="lg" />
        </div>
        <h3>Progreso</h3>
        <ProgressBar done={2} total={3} />
        <h3>Campos</h3>
        <Input label="Correo electrónico" placeholder="marta@ejemplo.com" />
        <PasswordInput
          label="Contraseña"
          hint="Mínimo 8 caracteres, con una mayúscula y un número"
        />
        <Input label="Con error" defaultValue="abc" error="La contraseña es demasiado corta" />
      </Card>
    </main>
  );
}
