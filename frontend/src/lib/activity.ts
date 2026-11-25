import { formatDueDate, timeAgo } from "./format";
import type { ActivityView, FeedItem } from "./types";

const STATUS: Record<string, string> = {
  TODO: "Por hacer",
  IN_PROGRESS: "En curso",
  DONE: "Hecha",
};
const PRIORITY: Record<string, string> = { HIGH: "alta", MEDIUM: "media", LOW: "baja" };

/** `data` values are strings or null; anything unexpected reads as empty. */
const str = (value: unknown): string => (typeof value === "string" ? value : "");

/** "2030-01-05" -> "5 ene". */
const day = (value: unknown): string =>
  typeof value === "string" ? formatDueDate(`${value}T00:00:00.000Z`) : "";

/**
 * The sentence of an event, in pieces: the task title is a link while the task
 * still exists. The actor goes apart (it is shown in bold).
 */
export function describe(event: ActivityView, projectId: string): FeedItem["parts"] {
  const { task, data } = event;
  const kind = task?.isSubtask ? "subtarea" : "tarea";
  const link = (): FeedItem["parts"][number] => ({
    text: `«${task?.title ?? ""}»`,
    href: task && !task.deleted ? `/proyectos/${projectId}/tareas/${task.id}` : undefined,
  });
  const t = (text: string) => ({ text });

  switch (event.type) {
    case "TASK_CREATED":
      return [t(`creó la ${kind} `), link()];
    case "TASK_DELETED": {
      const subtasks = Number(data?.subtasks ?? 0);
      const extra = subtasks > 0 ? ` y sus ${subtasks === 1 ? "1 subtarea" : `${subtasks} subtareas`}` : "";
      return [t(`eliminó la ${kind} `), link(), t(extra)];
    }
    case "TITLE_CHANGED":
      return [t(`renombró la ${kind} «${str(data?.from)}» a `), link()];
    case "DESCRIPTION_CHANGED":
      return [t("editó la descripción de "), link()];
    case "STATUS_CHANGED":
      // Completing reads better as its own sentence (it is what a parent's history shows of a subtask).
      if (data?.to === "DONE") return [t(`completó la ${kind} `), link()];
      return [
        t("movió "),
        link(),
        t(` de ${STATUS[str(data?.from)] ?? "?"} a ${STATUS[str(data?.to)] ?? "?"}`),
      ];
    case "PRIORITY_CHANGED":
      return [
        t("cambió la prioridad de "),
        link(),
        t(` de ${PRIORITY[str(data?.from)] ?? "?"} a ${PRIORITY[str(data?.to)] ?? "?"}`),
      ];
    case "DUE_DATE_CHANGED":
      return data?.to
        ? [t("puso la fecha límite de "), link(), t(` al ${day(data.to)}`)]
        : [t("quitó la fecha límite de "), link()];
    case "ASSIGNEE_CHANGED":
      if (!data?.to) return [t("quitó el responsable de "), link()];
      return data.from
        ? [t("reasignó "), link(), t(` de ${str(data.from)} a ${str(data.to)}`)]
        : [t("asignó "), link(), t(` a ${str(data.to)}`)];
    case "LABEL_ADDED":
      return [t(`añadió la etiqueta «${str(data?.label)}» a `), link()];
    case "LABEL_REMOVED":
      return [t(`quitó la etiqueta «${str(data?.label)}» de `), link()];
    case "COMMENT_ADDED":
      return [t("comentó en "), link()];
    case "MEMBER_ADDED":
      return [t(`añadió a ${str(data?.name)} al proyecto`)];
    case "MEMBER_REMOVED":
      return [t(`quitó a ${str(data?.name)} del proyecto`)];
    case "MEMBER_PROMOTED":
      return [t(`nombró propietario a ${str(data?.name)}`)];
    case "MEMBER_DEMOTED":
      return [t(`quitó el rol de propietario a ${str(data?.name)}`)];
    case "MEMBER_LEFT":
      return [t("dejó el proyecto")];
  }
}

/** Formats on the server (like comments), so server and browser show the same time. */
export function toFeedItem(event: ActivityView, projectId: string): FeedItem {
  return {
    id: event.id,
    actor: event.actor.name,
    parts: describe(event, projectId),
    when: timeAgo(event.createdAt),
  };
}
