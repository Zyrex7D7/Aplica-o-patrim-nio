import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NavSidebar } from "@/components/nav-sidebar";
import { MobileHeader } from "@/components/mobile-header";
import { BottomNav } from "@/components/bottom-nav";
import { RegisterServiceWorker } from "@/components/register-sw";
import { getHeaderSummary } from "@/lib/data/header-summary";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Meu Capital — Património & Finanças Pessoais",
  description: "Gestor de património e orçamento pessoal, com importação de extratos DEGIRO.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Meu Capital" },
};

export const viewport: Viewport = {
  themeColor: "#0A0F1F",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const summary = await getHeaderSummary();

  return (
    <html lang="pt-PT" className="h-full antialiased overflow-x-hidden">
      <body className="min-h-full bg-ink text-text font-sans overflow-x-hidden">
        <div className="flex min-h-screen">
          <NavSidebar />
          <main className="flex-1 min-w-0 pt-[calc(60px+env(safe-area-inset-top))] pb-[calc(72px+env(safe-area-inset-bottom))] md:pt-0 md:pb-0">
            {children}
          </main>
        </div>
        <MobileHeader summary={summary} />
        <BottomNav />
        <RegisterServiceWorker />
        <Toaster theme="dark" position="top-center" richColors />
      </body>
    </html>
  );
}
