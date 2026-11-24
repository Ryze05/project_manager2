import { z } from "zod";

/** Mirrors the API's limits for instant feedback; the API stays the source of truth. */
export const projectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Escribe un nombre")
    .max(100, "Máximo 100 caracteres"),
  description: z.string().trim().max(1000, "Máximo 1000 caracteres"),
});
