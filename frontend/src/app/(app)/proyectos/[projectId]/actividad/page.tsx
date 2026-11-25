import Link from "next/link";
import { ActivityFeed } from "@/components/ActivityFeed/ActivityFeed";
import { Card } from "@/components/ui";
import { toFeedItem } from "@/lib/activity";
import { getActivity, getMembers, getProject } from "@/lib/queries";
import styles from "../../projects.module.css";
import { AutoForm } from "../AutoForm";
import filters from "../filters.module.css";

export const metadata = { title: "Actividad · Gestor de proyectos" };

const PAGE = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ActivityPage({
  params,
  searchParams,
}: PageProps<"/proyectos/[projectId]/actividad">) {
  const { projectId } = await params;
  // `?persona=<id>`: anything that is not an id is ignored (a hand-edited URL must not give a 400).
  const raw = (await searchParams).persona;
  const persona = typeof raw === "string" && UUID.test(raw) ? raw : "";

  const [project, members, page] = await Promise.all([
    getProject(projectId),
    getMembers(projectId),
    getActivity(projectId, "", PAGE, persona),
  ]);
  const board = `/proyectos/${projectId}/actividad`;

  return (
    <div className={styles.formPage}>
      <Link href={`/proyectos/${projectId}`} className={styles.back}>
        ← {project.name}
      </Link>
      <header className={styles.head}>
        <h1>Actividad</h1>
      </header>
      <AutoForm action={board} className={filters.bar} label="Filtrar por persona">
        <select
          name="persona"
          aria-label="Persona"
          defaultValue={persona}
          className={`${filters.select} ${persona ? filters.active : ""}`}
        >
          <option value="">Todas las personas</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
        {persona && (
          <Link href={board} className={filters.clear}>
            Quitar filtro
          </Link>
        )}
      </AutoForm>
      <Card>
        <ActivityFeed
          // A new filter is a new list: remount instead of keeping the old pages.
          key={persona}
          projectId={projectId}
          actorId={persona}
          items={page.items.map((event) => toFeedItem(event, projectId))}
          nextCursor={page.nextCursor}
          limit={PAGE}
        />
      </Card>
    </div>
  );
}
