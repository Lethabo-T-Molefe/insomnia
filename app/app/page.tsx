import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";
import { Dashboard } from "@/components/dashboard";
import { getCurrentUser } from "@/lib/auth";

export default async function AppPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  // Do not block first paint on Supabase/Clerk sync — warm the user in background.
  after(() => {
    void getCurrentUser().catch((error) => {
      console.error("[app] background user sync failed", error);
    });
  });

  return (
    <Dashboard
      initialUser={{
        id: userId,
        email: "",
        name: "",
      }}
    />
  );
}
