"use client";

import { useActionState } from "react";
import { Button, Input, PasswordInput } from "@/components/ui";
import { loginAction, type AuthState } from "../actions";
import styles from "../auth.module.css";

const initial: AuthState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className={styles.form} noValidate>
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
        autoComplete="current-password"
        error={state.errors?.password}
      />
      {state.message && (
        <p className={styles.error} role="alert">
          {state.message}
        </p>
      )}
      <Button type="submit" block disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
