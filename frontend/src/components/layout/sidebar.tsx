"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  BookOpen,
  Upload,
  LogOut,
  Menu,
  X,
  Bell,
  Trophy,
  GraduationCap,
  Users,
  BarChart3,
  FileText,
  CheckCircle,
  Building2,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore, useUIStore } from "@/store/auth.store";
import { useState } from "react";
import { useTranslation } from "@/hooks/use-translation";

type Role = "STUDENT" | "TEACHER" | "ADMIN" | "SUPERADMIN";

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore();
  const { t, tSection } = useTranslation();
  const sidebarT = tSection("sidebar");

  const studentNavigation = [
    { name: sidebarT.dashboard, href: "/dashboard", icon: LayoutDashboard },
    { name: sidebarT.search, href: "/search", icon: Search },
    { name: sidebarT.courses, href: "/courses", icon: BookOpen },
    { name: sidebarT.contributorAccess, href: "/upload", icon: Upload },
    { name: sidebarT.leaderboard, href: "/leaderboard", icon: Trophy },
  ];

  const teacherNavigation = [
    { name: sidebarT.dashboard, href: "/teacher/dashboard", icon: LayoutDashboard },
    { name: sidebarT.manageCourses, href: "/teacher/manage-courses", icon: BookOpen },
    {
      name: sidebarT.contributions,
      href: "/teacher/manage-contributions",
      icon: CheckCircle,
    },
    { name: sidebarT.analytics, href: "/teacher/analytics", icon: BarChart3 },
  ];

  const adminNavigation = [
    { name: sidebarT.dashboard, href: "/admin/dashboard", icon: LayoutDashboard },
    { name: sidebarT.academicSetup, href: "/admin/setup", icon: Building2 },
    { name: sidebarT.users, href: "/admin/users", icon: Users },
    { name: sidebarT.teacherImport, href: "/admin/teachers/import", icon: FileText },
  ];

  const superadminNavigation = [
    { name: sidebarT.dashboard, href: "/superadmin/dashboard", icon: LayoutDashboard },
    {
      name: sidebarT.establishments,
      href: "/superadmin/establishments",
      icon: Building2,
    },
    { name: sidebarT.admins, href: "/superadmin/admins", icon: Users },
    { name: sidebarT.reports, href: "/superadmin/reports", icon: ShieldAlert },
  ];

  const baseNavigation: Record<
    Role,
    { name: string; href: string; icon: typeof LayoutDashboard }[]
  > = {
    STUDENT: studentNavigation,
    TEACHER: teacherNavigation,
    ADMIN: adminNavigation,
    SUPERADMIN: superadminNavigation,
  };

  const studentSectionItems = [
    { name: sidebarT.myFlashcards, href: "/my/flashcards", icon: BookOpen },
    { name: sidebarT.contributions, href: "/my/contributions", icon: Upload },
  ];

  const handleLogout = async () => {
    await logout();
  };

  const navigation =
    role === "STUDENT"
      ? studentNavigation.map((item) =>
          item.href === "/upload"
            ? {
                ...item,
                name: user?.is_contributor ? sidebarT.upload : sidebarT.contributorAccess,
              }
            : item,
        )
      : baseNavigation[role];

  return (
    <>

      <aside
        className={cn(
          "fixed inset-y-0 inset-inline-start-0 z-40 w-64 transform bg-card border-inline-end transition-transform duration-200 ease-in-out",
          sidebarOpen
            ? "translate-x-0 lg:translate-x-0"
            : "rtl:translate-x-full ltr:-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between px-6">
            <Link
              href={
                role === "STUDENT"
                  ? "/dashboard"
                  : `/${role.toLowerCase()}/dashboard`
              }
              className="flex items-center gap-2"
            >
              <GraduationCap className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-foreground">ATLAS</span>
            </Link>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/30",
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}

            {role === "STUDENT" && (
              <>
                <div className="py-4">
                  <div className="border-t border-sidebar-border" />
                </div>
                <p className="px-4 text-xs font-semibold uppercase text-sidebar-foreground/50">
                  {sidebarT.myLearning}
                </p>
                {studentSectionItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/30",
                      )}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon className="h-5 w-5" />
                      {item.name}
                    </Link>
                  );
                })}
              </>
            )}
            {role === "TEACHER" && (
               <>
               <div className="py-4">
                 <div className="border-t border-sidebar-border" />
               </div>
               <p className="px-4 text-xs font-semibold uppercase text-sidebar-foreground/50">
                 {sidebarT.teaching}
               </p>
             </>
            )}
            {role === "ADMIN" && (
               <>
               <div className="py-4">
                 <div className="border-t border-sidebar-border" />
               </div>
               <p className="px-4 text-xs font-semibold uppercase text-sidebar-foreground/50">
                 {sidebarT.management}
               </p>
             </>
            )}
            {role === "SUPERADMIN" && (
               <>
               <div className="py-4">
                 <div className="border-t border-sidebar-border" />
               </div>
               <p className="px-4 text-xs font-semibold uppercase text-sidebar-foreground/50">
                 {sidebarT.superadmin}
               </p>
             </>
            )}
          </nav>

          <div className="border-t border-sidebar-border p-4">
            <div className="space-y-2">

              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/30 transition-all duration-200"
              >
                <LogOut className="h-5 w-5" />
                {sidebarT.signOut}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={toggleSidebar}
        />
      )}
    </>
  );
}
