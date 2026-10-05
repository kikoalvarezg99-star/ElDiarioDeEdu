import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import RegistrarSW from "@/components/RegistrarSW";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Eduardo Rivero · Nutrición",
  description: "Seguimiento nutricional personalizado",
  icons: { icon: `${base}/icon-192.png`, apple: `${base}/icon-192.png` },
  appleWebApp: { capable: true, title: "E. Rivero", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#2c5036",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen font-sans antialiased">
        <RegistrarSW />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
