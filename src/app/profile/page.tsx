import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-session";

export default async function ProfilePage() {
  const session = await getServerSession();
  redirect(session ? "/" : "/login");
}
