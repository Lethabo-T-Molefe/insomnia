import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Dashboard } from "@/components/dashboard";
import { getCurrentUser } from "@/lib/auth";

export default async function AppPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return <Dashboard initialUser={user} />;
}
