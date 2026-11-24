import styles from "./auth.module.css";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return <main className={styles.page}>{children}</main>;
}
