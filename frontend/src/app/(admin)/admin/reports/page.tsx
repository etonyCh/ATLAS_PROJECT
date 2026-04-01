"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  MessageSquareWarning,
} from "lucide-react";
import { adminApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";

const statusOptions = [
  { value: "all", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "RESOLVED", label: "Resolved" },
] as const;

function formatSeverity(severity?: string | null) {
  if (!severity) return "Unspecified";
  return severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase();
}

function formatType(type?: string) {
  if (!type) return "Other";
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

export default function AdminReportsPage() {
  const [status, setStatus] = useState<(typeof statusOptions)[number]["value"]>("all");
  const queryClient = useQueryClient();

  const reportsQuery = useQuery({
    queryKey: ["admin", "reports", status],
    queryFn: () =>
      adminApi.listReports({
        status: status === "all" ? undefined : status,
        limit: 50,
        offset: 0,
      }),
  });

  const resolveReportMutation = useMutation({
    mutationFn: (reportId: string) =>
      adminApi.resolveReport(reportId, { action: "dismiss" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "admin", "reports"] });
    },
  });

  const stats = useMemo(() => {
    const items = reportsQuery.data?.items ?? [];
    return {
      total: reportsQuery.data?.meta.total ?? 0,
      pending: items.filter((item) => !item.is_resolved).length,
      resolved: items.filter((item) => item.is_resolved).length,
      critical: items.filter((item) => item.severity?.toLowerCase() === "critical").length,
    };
  }, [reportsQuery.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports & Moderation</h1>
          <p className="text-muted-foreground">
            Review user feedback, bug reports, and content issues from one queue.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((option) => (
            <Button
              key={option.value}
              variant={status === option.value ? "default" : "outline"}
              onClick={() => setStatus(option.value)}
              className="min-h-11"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Reports</p>
              <p className="mt-2 text-2xl font-bold">{stats.total}</p>
            </div>
            <FileText className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="mt-2 text-2xl font-bold">{stats.pending}</p>
            </div>
            <Clock3 className="h-5 w-5 text-amber-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Resolved</p>
              <p className="mt-2 text-2xl font-bold">{stats.resolved}</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Critical</p>
              <p className="mt-2 text-2xl font-bold">{stats.critical}</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Moderation Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {reportsQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((key) => (
                <Skeleton key={key} className="h-36 w-full" />
              ))}
            </div>
          ) : reportsQuery.data?.items.length ? (
            <div className="space-y-4">
              {reportsQuery.data.items.map((report) => (
                <div
                  key={report.id}
                  className="rounded-xl border p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusChip
                          status={report.is_resolved ? "approved" : "pending"}
                          label={report.is_resolved ? "Resolved" : "Pending"}
                        />
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          {formatType(report.type)}
                        </span>
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          Severity: {formatSeverity(report.severity)}
                        </span>
                      </div>

                      <div>
                        <h2 className="text-lg font-semibold">{report.title}</h2>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                          {report.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>
                          Submitted {new Date(report.created_at).toLocaleString()}
                        </span>
                        {report.screenshot_url && (
                          <a
                            href={report.screenshot_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            View screenshot
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                      <Button
                        className="min-h-11"
                        disabled={
                          report.is_resolved || resolveReportMutation.isPending
                        }
                        onClick={() => resolveReportMutation.mutate(report.id)}
                      >
                        Mark Resolved
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              type="no-data"
              title="No reports in this view"
              description="New bug reports and product feedback will appear here."
              icon={MessageSquareWarning}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
