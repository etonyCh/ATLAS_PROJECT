"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/layout/auth-guard";
import { useUIStore } from "@/store/auth.store";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Header } from "@/components/layout/header";
import { CommandPalette } from "@/components/layout/command-palette";
import { Footer } from "@/components/layout/footer";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { sidebarOpen } = useUIStore();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const isLearningPage = pathname.includes("/read") || 
                         pathname.includes("/flashcards") || 
                         pathname.includes("/quiz");

  return (
    <AuthGuard allowedRoles={["STUDENT"]}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar role="STUDENT" />
        
        <div className={cn(
          "flex flex-1 flex-col overflow-hidden transition-all duration-300",
          sidebarOpen ? "lg:ms-64" : "lg:ms-20"
        )}>
          <Header className="flex-shrink-0" />
          
          <main className="flex-1 overflow-y-auto bg-transparent">
            <div className="container mx-auto p-4 pb-20 lg:p-6 lg:pb-6">
              {children}
            </div>
            {!isLearningPage && <Footer variant="minimal" />}
          </main>
          
          <BottomNav />
        </div>

        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
        />
      </div>
    </AuthGuard>
  );
}
