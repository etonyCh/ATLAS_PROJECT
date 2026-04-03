"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CheckCircle, Clock, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import { contributionsApi } from "@/lib/api";
import { useTeacherAnalyticsQuery } from "@/queries/dashboard";
import { useAuthStore } from "@/store/auth.store";
import type { Contribution } from "@/types/api.types";

export function TeacherDashboardPageClient() {
  const { user } = useAuthStore();
  const analyticsQuery = useTeacherAnalyticsQuery();
  const queueQuery = useQuery({
    queryKey: ["dashboard", "teacher", "contributions"],
    queryFn: () => contributionsApi.admin.list({ limit: 5, offset: 0 }),
  });

  const isLoading = analyticsQuery.isLoading || queueQuery.isLoading;
  const stats = [
    {
      title: "Total Uploads",
      value: analyticsQuery.data?.total_uploads ?? 0,
      icon: Upload,
    },
    {
      title: "Approved Uploads",
      value: analyticsQuery.data?.approved_uploads ?? 0,
      icon: CheckCircle,
    },
    {
      title: "Pending Reviews",
      value: queueQuery.data?.meta.total ?? 0,
      icon: Clock,
    },
    {
      title: "Courses Contributed To",
      value: analyticsQuery.data?.total_courses ?? 0,
      icon: BookOpen,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, {user?.full_name?.split(" ")[0] || "Teacher"}!
          </h1>
          <p className="text-muted-foreground">
            Review the latest contribution activity and your upload totals.
          </p>
        </div>
        <Button asChild>
          <Link href="/teacher/manage-contributions">Review Contributions</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4">
              {isLoading ? (
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Contribution Queue</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/teacher/manage-contributions">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {queueQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((key) => (
                <Skeleton key={key} className="h-16 w-full" />
              ))}
            </div>
          ) : queueQuery.data?.items.length ? (
            <div className="space-y-3">
              {queueQuery.data.items.map((contribution: Contribution) => (
                <div
                  key={contribution.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{contribution.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Uploaded {new Date(contribution.created_at).toLocaleString()}
                    </p>
                  </div>
                  <StatusChip status={contribution.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              type="contributions"
              title="No contributions in review"
              description="New uploads will appear here when students submit them."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Top Course Areas</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/teacher/analytics">Open analytics</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {analyticsQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((key) => (
                <Skeleton key={key} className="h-16 w-full" />
              ))}
            </div>
          ) : analyticsQuery.data?.top_courses.length ? (
            <div className="space-y-3">
              {analyticsQuery.data.top_courses.slice(0, 3).map((course) => (
                <div key={course.course_id} className="rounded-lg border p-3">
                  <p className="font-medium">{course.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {course.uploads} uploads, {course.approved_uploads} approved
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              type="no-data"
              title="No teacher analytics yet"
              description="Your top course areas will appear after you upload materials."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
