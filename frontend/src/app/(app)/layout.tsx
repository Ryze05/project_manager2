import { Sidebar } from "@/components/Sidebar/Sidebar";
import { getMe, getMyTasks, getProjects } from "@/lib/queries";
import styles from "./app.module.css";

/** Shell of every signed-in screen: side navigation + page. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [user, projects, pending] = await Promise.all([
    getMe(),
    getProjects(),
    // Default listing = to do + in progress: that is the "pending" counter.
    getMyTasks(false),
  ]);

  return (
    <div className={styles.app}>
      <Sidebar user={user} projects={projects} pendingCount={pending.length} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
