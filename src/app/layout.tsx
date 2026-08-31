import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NavSidebar } from "@/components/nav-sidebar";
import { MobileHeader } from "@/components/mobile-header";
import { MobileNav } from "@/components/mobile-nav";
import { RegisterServiceWorker } from "@/components/register-sw";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Meu Capital — Património & Finanças Pessoais",
  description: "Gestor de património e orçamento pessoal, com importação de extratos DEGIRO.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Meu Capital",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0F14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" className="h-full antialiased">
      <body className="min-h-full bg-ink text-text font-sans">
        <div className="flex min-h-screen">
          <NavSidebar />
          <main className="flex-1 min-w-0 pb-20 md:pb-0 pt-[calc(52px+env(safe-area-inset-top))] md:pt-0">
            {children}
          </main>
        </div>
        <MobileHeader />
        <MobileNav />
        <RegisterServiceWorker />
        <Toaster theme="dark" position="top-right" richColors />
      </body>
    </html>
  );
}
