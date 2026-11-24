import styles from "./auth.module.css";

export function AuthHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <>
      <div className={styles.logo}>
        <span className={styles.logoMark}>N</span> Nombre
      </div>
      <div className={styles.title}>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </>
  );
}
