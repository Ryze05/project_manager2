import { Sidebar } from "@/components/Sidebar/Sidebar";
import { getMe, getMyInvitations, getMyTasks, getProjects } from "@/lib/queries";
import styles from "./app.module.css";

/** Shell of every signed-in screen: side navigation + page. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [user, projects, pending, invitations] = await Promise.all([
    getMe(),
    getProjects(),
    // Default listing = to do + in progress: that is the "pending" counter.
    getMyTasks(false),
    getMyInvitations(),
  ]);

  return (
    <div className={styles.app}>
      <Sidebar user={user} // Archived projects live in their own tab, not in the sidebar.
      projects={projects.filter((project) => !project.archivedAt)} pendingCount={pending.length}
        invitationCount={invitations.length}
      />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
