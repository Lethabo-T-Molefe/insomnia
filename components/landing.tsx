"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Brand } from "@/components/brand";

export function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-10%,color-mix(in_oklab,var(--primary)_28%,transparent),transparent_58%),radial-gradient(ellipse_45%_40%_at_90%_20%,color-mix(in_oklab,var(--accent)_14%,transparent),transparent_50%),linear-gradient(180deg,var(--deep),var(--background)_42%,var(--deep))]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(color-mix(in_oklab,var(--foreground)_40%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_oklab,var(--foreground)_40%,transparent)_1px,transparent_1px)] [background-size:48px_48px]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Brand size="md" href="/" />
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-md px-3 py-2 font-mono text-sm text-muted-foreground transition hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground transition hover:-translate-y-px"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-5.5rem)] w-full max-w-6xl flex-col justify-center px-5 pb-16 pt-8 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl"
        >
          <Brand size="hero" href={null} className="mb-8" />
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            Keep your free hosts awake.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Insomnia by Chopa pings your URLs on your schedule so staging APIs
            and free tiers do not fall asleep.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/signup"
                className="inline-flex rounded-md bg-primary px-5 py-3 font-bold text-primary-foreground"
              >
                Start watching
              </Link>
            </motion.div>
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/login"
                className="inline-flex rounded-md border border-border px-5 py-3 font-mono text-sm text-foreground transition hover:bg-secondary"
              >
                I already have an account
              </Link>
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          aria-hidden
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none absolute right-[-8%] top-[18%] hidden h-[420px] w-[420px] rounded-full border border-primary/20 lg:block"
        >
          <div className="absolute inset-10 rounded-full border border-accent/15" />
          <div className="absolute inset-24 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--primary)_35%,transparent),transparent_70%)] blur-xl" />
        </motion.div>
      </main>
    </div>
  );
}
