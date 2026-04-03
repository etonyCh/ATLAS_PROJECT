"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BookOpen, Clock, FileText, ShieldAlert, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import { adminApi, contributionsApi } from "@/lib/api";
import { useAdminDashboardQuery } from "@/queries/dashboard";
import { useAuthStore } from "@/store/auth.store";

export function AdminDashboardPageClient() {
  const { user } = useAuthStore();
  const dashboardQuery = useAdminDashboardQuery();
  const reportsQuery = useQuery({
    queryKey: ["dashboard", "admin", "reports"],
    queryFn: () => adminApi.listReports({ limit: 5, offset: 0 }),
  });
  const contributionsQuery = useQuery({
    queryKey: ["dashboard", "admin", "pending-contributions"],
    queryFn: () =>
      contributionsApi.admin.list({ status: "PENDING", limit: 5, offset: 0 }),
  });

  const stats = [
    {
      title: "Total Users",
      value: dashboardQuery.data?.total_users ?? 0,
      icon: Users,
    },
    {
      title: "Total Courses",
      value: dashboardQuery.data?.total_courses ?? 0,
      icon: BookOpen,
    },
    {
      title: "Pending Contributions",
      value: dashboardQuery.data?.pending_contributions ?? 0,
      icon: Clock,
    },
    {
      title: "Total Reports",
      value: dashboardQuery.data?.total_reports ?? 0,
      icon: FileText,
    },
    {
      title: "Pending Reports",
      value: dashboardQuery.data?.pending_reports ?? 0,
      icon: ShieldAlert,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.full_name?.split(" ")[0] || "Admin"}.
          Platform totals and moderation queues are shown below.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4">
              {dashboardQuery.isLoading ? (
                <>
                  <Skeleton className="mb-2 h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <stat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="mt-2 text-2xl font-bold">{stat.value}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Reports</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/moderation">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {reportsQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((key) => (
                  <Skeleton key={key} className="h-16 w-full" />
                ))}
              </div>
            ) : reportsQuery.data?.items.length ? (
              <div className="space-y-3">
                {reportsQuery.data.items.map((report) => (
                  <div
                    key={report.id}
                    className="rounded-lg border p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{report.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {report.description}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {new Date(report.created_at).toLocaleString()}
                        </p>
                      </div>
                      <StatusChip
                        status={report.is_resolved ? "approved" : "pending"}
                        label={report.is_resolved ? "Resolved" : "Pending"}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                type="no-data"
                title="No reports available"
                description="User reports will appear here when they are submitted."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg">Pending Contributions</CardTitle>
          </CardHeader>
          <CardContent>
            {contributionsQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((key) => (
                  <Skeleton key={key} className="h-16 w-full" />
                ))}
              </div>
            ) : contributionsQuery.data?.items.length ? (
              <div className="space-y-3">
                {contributionsQuery.data.items.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.description || "No description provided."}
                        </p>
                      </div>
                      <StatusChip status={item.status} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                type="contributions"
                title="No pending contributions"
                description="All contribution reviews are currently up to date."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Users By Role</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboardQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((key) => (
                  <Skeleton key={key} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(dashboardQuery.data?.users_by_role ?? {}).map(
                  ([role, count]) => (
                    <div
                      key={role}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <span className="font-medium">{role}</span>
                      <span className="text-sm text-muted-foreground">{count}</span>
                    </div>
                  ),
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contribution Status Mix</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboardQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((key) => (
                  <Skeleton key={key} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(
                  dashboardQuery.data?.contributions_by_status ?? {},
                ).map(([status, count]) => (
                  <div
                    key={status}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <StatusChip status={status} />
                    <span className="text-sm text-muted-foreground">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
