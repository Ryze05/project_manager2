import { z } from "zod";

/**
 * Only simple rules, for instant feedback. The API stays the source of truth
 * and its errors are always shown too.
 */
export const registerSchema = z.object({
  name: z.string().trim().min(1, "Escribe tu nombre"),
  email: z.email("Escribe un correo válido"),
  password: z
    .string()
    .regex(
      /^(?=.*[A-Z])(?=.*\d).{8,}$/,
      "Mínimo 8 caracteres, con una mayúscula y un número",
    ),
});

/** Login does not re-check the password rules: the API answers a generic 401. */
export const loginSchema = z.object({
  email: z.email("Escribe un correo válido"),
  password: z.string().min(1, "Escribe tu contraseña"),
});
