"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/layout/auth-guard";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CommandPalette } from "@/components/layout/command-palette";
import { Footer } from "@/components/layout/footer";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/auth.store";

export default function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sidebarOpen } = useUIStore();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  return (
    <AuthGuard allowedRoles={["SUPERADMIN"]}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar role="SUPERADMIN" />
        
        <div className={cn(
          "flex flex-1 flex-col overflow-hidden transition-all duration-300",
          sidebarOpen ? "lg:ms-64" : "lg:ms-20"
        )}>
          <Header className="flex-shrink-0" />
          
          <main className="flex-1 overflow-y-auto bg-transparent">
            <div className="container mx-auto p-4 lg:p-6">
              {children}
            </div>
            <Footer variant="minimal" />
          </main>
        </div>

        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
        />
      </div>
    </AuthGuard>
  );
}
