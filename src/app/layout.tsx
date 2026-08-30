import type { Metadata } from "next";
import "./globals.css";
import { NavSidebar } from "@/components/nav-sidebar";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Livro — Património & Finanças Pessoais",
  description: "Gestor de património e orçamento pessoal, com importação de extratos DEGIRO.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" className="h-full antialiased">
      <body className="min-h-full bg-ink text-text font-sans">
        <div className="flex min-h-screen">
          <NavSidebar />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
        <Toaster theme="dark" position="top-right" richColors />
      </body>
    </html>
  );
}
