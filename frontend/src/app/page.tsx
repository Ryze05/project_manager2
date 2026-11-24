import { redirect } from "next/navigation";

/** No landing: the proxy sends visitors without a session to /login. */
export default function Home() {
  redirect("/proyectos");
}
