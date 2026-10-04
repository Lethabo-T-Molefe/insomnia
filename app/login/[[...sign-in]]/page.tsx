import Link from "next/link";
import { Show, SignIn } from "@clerk/nextjs";
import { Brand } from "@/components/brand";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_20%_0%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_55%)]"
      />
      <div className="relative z-10 w-full max-w-md">
        <Brand size="md" href="/" className="mb-6" />
        <p className="label-mono text-muted-foreground">Insomnia</p>
        <h1 className="mt-3 mb-6 text-4xl font-bold tracking-tight">
          Welcome back
        </h1>

        <Show when="signed-out">
          <SignIn
            routing="path"
            path="/login"
            forceRedirectUrl="/app"
            signUpUrl="/signup"
            appearance={{
              elements: {
                rootBox: "mx-auto w-full",
                cardBox: "shadow-none",
                card: "bg-transparent shadow-none",
              },
            }}
          />
        </Show>

        <Show when="signed-in">
          <div className="surface-card rounded-[var(--radius)] p-5">
            <p className="font-mono text-sm text-muted-foreground">
              You are already signed in.
            </p>
            <Link
              href="/app"
              className="mt-4 inline-flex rounded-md bg-primary px-4 py-2.5 font-bold text-primary-foreground"
            >
              Go to dashboard
            </Link>
          </div>
        </Show>
      </div>
    </div>
  );
}
