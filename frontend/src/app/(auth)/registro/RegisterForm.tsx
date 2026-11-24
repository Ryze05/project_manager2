"use client";

import { useActionState } from "react";
import { Button, Input, PasswordInput } from "@/components/ui";
import { registerAction, type AuthState } from "../actions";
import styles from "../auth.module.css";

const initial: AuthState = {};

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initial);

  return (
    <form action={action} className={styles.form} noValidate>
      <Input
        name="name"
        label="Nombre"
        placeholder="Marta"
        autoComplete="name"
        defaultValue={state.values?.name}
        error={state.errors?.name}
      />
      <Input
        name="email"
        type="email"
        label="Correo electrónico"
        placeholder="marta@ejemplo.com"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={state.errors?.email}
      />
      <PasswordInput
        name="password"
        label="Contraseña"
        placeholder="••••••••"
        autoComplete="new-password"
        hint="Mínimo 8 caracteres, con una mayúscula y un número"
        error={state.errors?.password}
      />
      {state.message && (
        <p className={styles.error} role="alert">
          {state.message}
        </p>
      )}
      <Button type="submit" block disabled={pending}>
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
    </form>
  );
}
