import { Sidebar } from "@/components/Sidebar/Sidebar";
import { api, unwrap } from "@/lib/api";
import type { CurrentUser, MyTaskView, ProjectView } from "@/lib/types";
import styles from "./app.module.css";

/** Shell of every signed-in screen: side navigation + page. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [user, projects, pending] = await Promise.all([
    api<CurrentUser>("/auth/me").then(unwrap),
    api<ProjectView[]>("/projects").then(unwrap),
    // Default listing = to do + in progress: that is the "pending" counter.
    api<MyTaskView[]>("/me/tasks").then(unwrap),
  ]);

  return (
    <div className={styles.app}>
      <Sidebar user={user} projects={projects} pendingCount={pending.length} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
