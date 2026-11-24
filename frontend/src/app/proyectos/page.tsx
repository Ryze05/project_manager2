import { redirect } from "next/navigation";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import { logoutAction } from "../(auth)/actions";

/** Temporary: proves the session end to end. Replaced by the real project list. */
export default async function ProjectsPage() {
  const me = await api<{ id: string; name: string; email: string }>("/auth/me");

  if (!me.ok) {
    if (me.status === 401) {
      // Expired or invalid token: Server Components cannot delete cookies,
      // so the login page is reached through the logout action's route.
      redirect("/sesion-caducada");
    }
    return <p style={{ padding: "var(--page-pad)" }}>{me.message}</p>;
  }

  return (
    <main style={{ padding: "var(--page-pad)" }}>
      <h1>Hola, {me.data.name}</h1>
      <form action={logoutAction}>
        <Button type="submit" variant="ghost">
          Cerrar sesión
        </Button>
      </form>
    </main>
  );
}
