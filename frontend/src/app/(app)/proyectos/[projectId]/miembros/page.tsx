import Link from "next/link";
import { Avatar, Badge, Card } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { getMe, getMembers, getProject, getProjectInvitations } from "@/lib/queries";
import styles from "../../projects.module.css";
import { CancelInvitation } from "./CancelInvitation";
import { DemoteOwner } from "./DemoteOwner";
import { InviteForm } from "./InviteForm";
import { LeaveProject } from "./LeaveProject";
import { RemoveMember } from "./RemoveMember";
import { RoleButton } from "./RoleButton";

export const metadata = { title: "Miembros · Gestor de proyectos" };

export default async function MembersPage({
  params,
}: PageProps<"/proyectos/[projectId]/miembros">) {
  const { projectId } = await params;
  const [project, members, me] = await Promise.all([
    getProject(projectId),
    getMembers(projectId),
    getMe(),
  ]);
  // Pending invitations are for owners only (the API refuses everyone else).
  const invitations = project.role === "OWNER" ? await getProjectInvitations(projectId) : [];
  // Archived projects are read-only: nobody is added or removed.
  const readOnly = project.archivedAt !== null;
  const isOwner = project.role === "OWNER" && !readOnly;
  // Someone must stay in charge: the last owner can neither step down nor leave.
  const ownerCount = members.filter((member) => member.role === "OWNER").length;
  const lastOwner = project.role === "OWNER" && ownerCount === 1;

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
              <h3>Invitar a alguien</h3>
              <span className={styles.small}>
                Solo usuarios ya registrados; entran cuando aceptan
              </span>
            </div>
            <InviteForm projectId={projectId} />
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
                {isOwner && member.role === "MEMBER" && (
                  <>
                    <RoleButton projectId={projectId} userId={member.id} promote />
                    <RemoveMember projectId={projectId} userId={member.id} name={member.name} />
                  </>
                )}
                {isOwner && member.role === "OWNER" && ownerCount > 1 && (
                  <DemoteOwner
                    projectId={projectId}
                    userId={member.id}
                    name={member.name}
                    isMe={member.id === me.id}
                  />
                )}
              </li>
            ))}
          </ul>
        </Card>

        {project.role === "OWNER" && invitations.length > 0 && (
          <Card>
            <div className={styles.cardHead}>
              <h3>Invitaciones pendientes</h3>
              <span className={styles.small}>{invitations.length}</span>
            </div>
            <ul className={styles.list}>
              {invitations.map((invitation) => (
                <li key={invitation.id}>
                  <Avatar name={invitation.user.name} />
                  <div className={styles.listBody}>
                    <span className={styles.listTitle}>{invitation.user.name}</span>
                    <span className={styles.listMeta}>
                      {invitation.user.email} · invitó {invitation.invitedBy.name}{" "}
                      {timeAgo(invitation.createdAt)}
                    </span>
                  </div>
                  {isOwner && (
                    <CancelInvitation projectId={projectId} invitationId={invitation.id} />
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {!readOnly && (
          <Card>
            <h3>Dejar el proyecto</h3>
            <p className={styles.dangerText}>
              {lastOwner
                ? "Eres el único propietario: nombra a otro propietario antes de poder dejarlo."
                : "Dejarás de ver el proyecto y tus tareas quedarán sin responsable."}
            </p>
            {!lastOwner && <LeaveProject projectId={projectId} name={project.name} />}
          </Card>
        )}
      </div>
    </div>
  );
}
