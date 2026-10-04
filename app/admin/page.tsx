import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { AdminDashboard } from "@/components/admin-dashboard";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "admin") {
    redirect("/app");
  }

  return <AdminDashboard initialUser={user} />;
}
