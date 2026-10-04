import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Comfortaa } from "next/font/google";
import { cn } from "@/lib/utils";
import "./globals.css";

const comfortaa = Comfortaa({
  variable: "--font-comfortaa",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Insomnia · Chopa", template: "%s · Insomnia" },
  description:
    "Keep free hosting services awake. Ping URLs on your schedule, per account.",
  applicationName: "Insomnia",
  icons: {
    icon: "/chopa-mark.png",
    apple: "/chopa-mark.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c222d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider
      telemetry={false}
      appearance={{
        variables: {
          colorPrimary: "#e8a54b",
          colorBackground: "#0c222d",
          colorInput: "#122433",
          borderRadius: "0.75rem",
          fontFamily: "var(--font-comfortaa), ui-rounded, system-ui, sans-serif",
        },
      }}
    >
      <html lang="en" className={cn("h-full dark", comfortaa.variable)}>
        <body className="flex min-h-full flex-col font-sans antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
