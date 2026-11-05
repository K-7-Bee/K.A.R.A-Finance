import { redirect } from "next/navigation";

// Signed-out visitors are sent to sign-in by the middleware first.
export default function Home() {
  redirect("/overview");
}
