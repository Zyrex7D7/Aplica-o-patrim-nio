import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NavSidebar } from "@/components/nav-sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Livro — Património & Finanças Pessoais",
  description: "Gestor de património e orçamento pessoal, com importação de extratos DEGIRO.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Livro",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0B0F14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" className="h-full antialiased">
      <body className="min-h-full bg-ink text-text font-sans">
        <div className="flex min-h-screen">
          <NavSidebar />
          <main className="flex-1 min-w-0 pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </main>
        </div>
        <BottomNav />
        <ServiceWorkerRegister />
        <Toaster theme="dark" position="top-right" richColors />
      </body>
    </html>
  );
}
