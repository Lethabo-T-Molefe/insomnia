import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Dashboard } from "@/components/dashboard";
import { getCurrentUser } from "@/lib/auth";

export default async function AppPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  // Ensure the DB user row exists before the client can create targets.
  // Cap wait so a slow DB cannot blank the page forever.
  const user = await Promise.race([
    getCurrentUser(),
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 8_000);
    }),
  ]);

  return (
    <Dashboard
      initialUser={
        user ?? {
          id: userId,
          email: "",
          name: "",
        }
      }
    />
  );
}
