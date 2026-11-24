import { z } from "zod";

/** Mirrors the API's limits for instant feedback; the API stays the source of truth. */
export const taskSchema = z.object({
  title: z.string().trim().min(1, "Escribe un título").max(200, "Máximo 200 caracteres"),
  description: z.string().trim().max(5000, "Máximo 5000 caracteres"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  dueDate: z.string(),
  assigneeId: z.string(),
});
