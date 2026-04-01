"use client";

import { CheckCircle2, Clock, FileX, Upload } from "lucide-react";
import { useTeacherAnalyticsQuery } from "@/queries/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export default function TeacherAnalyticsPage() {
  const analyticsQuery = useTeacherAnalyticsQuery();

  const stats = [
    {
      title: "Total Uploads",
      value: analyticsQuery.data?.total_uploads ?? 0,
      icon: Upload,
    },
    {
      title: "Approved Uploads",
      value: analyticsQuery.data?.approved_uploads ?? 0,
      icon: CheckCircle2,
    },
    {
      title: "Pending Uploads",
      value: analyticsQuery.data?.pending_uploads ?? 0,
      icon: Clock,
    },
    {
      title: "Rejected Uploads",
      value: analyticsQuery.data?.rejected_uploads ?? 0,
      icon: FileX,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">
          Track your upload performance, recent activity, and strongest course areas.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4">
              {analyticsQuery.isLoading ? (
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
          <CardHeader>
            <CardTitle className="text-lg">Activity Snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((key) => (
                  <Skeleton key={key} className="h-14 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Distinct Courses</p>
                  <p className="mt-2 text-3xl font-bold">
                    {analyticsQuery.data?.total_courses ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Uploads This Week</p>
                  <p className="mt-2 text-3xl font-bold">
                    {analyticsQuery.data?.recent_uploads_7d ?? 0}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Courses</CardTitle>
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
                {analyticsQuery.data.top_courses.map((course) => (
                  <div key={course.course_id} className="rounded-lg border p-4">
                    <p className="font-medium">{course.title}</p>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>{course.uploads} uploads</span>
                      <span>{course.approved_uploads} approved</span>
                      <span>
                        Last submission{" "}
                        {course.last_submission_at
                          ? new Date(course.last_submission_at).toLocaleDateString()
                          : "N/A"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                type="no-data"
                title="No course analytics yet"
                description="Upload course material to start building analytics."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
