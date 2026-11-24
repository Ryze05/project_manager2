import Link from "next/link";
import { Avatar, Badge, Button, Card } from "@/components/ui";
import { api, unwrap } from "@/lib/api";
import type { CurrentUser, MemberView, ProjectView } from "@/lib/types";
import styles from "../../projects.module.css";
import { removeMemberAction } from "./actions";
import { AddMemberForm } from "./AddMemberForm";

export const metadata = { title: "Miembros · Gestor de proyectos" };

export default async function MembersPage({
  params,
}: PageProps<"/proyectos/[projectId]/miembros">) {
  const { projectId } = await params;
  const [project, members, me] = await Promise.all([
    api<ProjectView>(`/projects/${projectId}`).then(unwrap),
    api<MemberView[]>(`/projects/${projectId}/members`).then(unwrap),
    api<CurrentUser>("/auth/me").then(unwrap),
  ]);
  const isOwner = project.role === "OWNER";

  return (
    <div className={styles.page}>
      <Link href={`/proyectos/${projectId}`} className={styles.back}>
        ← {project.name}
      </Link>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>{project.name}</p>
          <h1>Miembros</h1>
        </div>
      </header>

      <div className={styles.stack}>
        {isOwner && (
          <Card>
            <div className={styles.cardHead}>
              <h3>Añadir un miembro</h3>
              <span className={styles.small}>Solo usuarios ya registrados</span>
            </div>
            <AddMemberForm projectId={projectId} />
          </Card>
        )}

        <Card>
          <ul className={styles.list}>
            {members.map((member) => (
              <li key={member.id}>
                <Avatar name={member.name} me={member.id === me.id} />
                <div className={styles.listBody}>
                  <span className={styles.listTitle}>{member.name}</span>
                  <span className={styles.listMeta}>{member.email}</span>
                </div>
                <Badge tone={member.role === "OWNER" ? "accent" : "neutral"}>
                  {member.role === "OWNER" ? "Propietario" : "Miembro"}
                </Badge>
                {isOwner && member.role !== "OWNER" && (
                  <form action={removeMemberAction.bind(null, projectId, member.id)}>
                    <Button type="submit" variant="danger">
                      Quitar
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
