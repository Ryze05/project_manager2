import { Sidebar } from "@/components/Sidebar/Sidebar";
import { api, unwrap } from "@/lib/api";
import type { CurrentUser, ProjectView } from "@/lib/types";
import styles from "./app.module.css";

/** Shell of every signed-in screen: side navigation + page. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [user, projects] = await Promise.all([
    api<CurrentUser>("/auth/me").then(unwrap),
    api<ProjectView[]>("/projects").then(unwrap),
  ]);

  return (
    <div className={styles.app}>
      <Sidebar user={user} projects={projects} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
