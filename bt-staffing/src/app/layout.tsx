import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@fontsource-variable/inter";
import "./globals.css";
import { Toaster } from "@/components/Toaster";

export const metadata: Metadata = {
  title: { default: "BT Staffing · United Care ABA", template: "%s · BT Staffing" },
  description: "Get behavior technicians from applied to placed, faster.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Runs before paint: with no saved choice, follow the device's light/dark setting.
const themeScript = `(function(){var d=document.documentElement;if(!d.dataset.theme){d.dataset.theme=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const saved = (await cookies()).get("theme")?.value;
  const theme = saved === "dark" || saved === "light" ? saved : undefined;
  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
