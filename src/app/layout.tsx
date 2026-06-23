import type { Metadata } from "next";
import "./globals.css";
import { InstitutionalHeader } from "@/components/InstitutionalHeader";
import { ProjectProvider } from "@/context/ProjectContext";
import { AuthProvider } from "@/context/AuthContext";
import { ProfileGuard } from "@/components/ProfileGuard";
import { CursorAnchoredDialogs } from "@/components/CursorAnchoredDialogs";

export const metadata: Metadata = {
  title: "Perfilador Remoto",
  description:
    "Plataforma del Centro de Estudios y Política Criminal (CEIPOL) - SSP Aguascalientes. Análisis criminológico ambiental a partir de evidencia fotográfica georreferenciada.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <CursorAnchoredDialogs />
        <AuthProvider>
          <ProfileGuard>
            <InstitutionalHeader />
            <ProjectProvider>
              <main className="mx-auto flex min-h-screen w-full flex-col gap-6 px-4 py-6 md:py-8">
                {children}
              </main>
            </ProjectProvider>
          </ProfileGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
