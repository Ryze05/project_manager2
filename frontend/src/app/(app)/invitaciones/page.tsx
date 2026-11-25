import { Avatar, Card } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { getMyInvitations } from "@/lib/queries";
import styles from "../proyectos/projects.module.css";
import { AnswerInvitation } from "./AnswerInvitation";

export const metadata = { title: "Invitaciones · Gestor de proyectos" };

export default async function InvitationsPage() {
  const invitations = await getMyInvitations();

  return (
    <div className={styles.formPage}>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>Proyectos a los que te han invitado</p>
          <h1>Invitaciones</h1>
        </div>
      </header>

      {invitations.length === 0 ? (
        <div className={styles.empty}>
          <p>No tienes invitaciones pendientes.</p>
        </div>
      ) : (
        <Card>
          <ul className={styles.list}>
            {invitations.map((invitation) => (
              <li key={invitation.id}>
                <Avatar name={invitation.project.name} shape="project" />
                <div className={styles.listBody}>
                  <span className={styles.listTitle}>{invitation.project.name}</span>
                  <span className={styles.listMeta}>
                    Te invitó {invitation.invitedBy.name} {timeAgo(invitation.createdAt)}
                  </span>
                </div>
                <div className={styles.rowActions}>
                  <AnswerInvitation invitationId={invitation.id} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
