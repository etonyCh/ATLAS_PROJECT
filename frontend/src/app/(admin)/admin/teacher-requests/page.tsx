"use client";

import { Loader2, ShieldCheck, UserRoundSearch } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import { useApproveTeacherRequestMutation, useTeacherRequestsQuery } from "@/queries/admin.queries";

export default function AdminTeacherRequestsPage() {
  const teacherRequestsQuery = useTeacherRequestsQuery();
  const approveTeacherRequestMutation = useApproveTeacherRequestMutation();
  const requests = teacherRequestsQuery.data?.items ?? [];

  if (teacherRequestsQuery.isLoading) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Teacher Verification Requests</h1>
        <p className="text-muted-foreground">
          Review educator onboarding requests and approve institutional access.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Pending Queue</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Requests remain pending until an admin approves them.
            </p>
          </div>
          <StatusChip status={requests.length ? "warning" : "active"} label={`${requests.length} pending`} />
        </CardHeader>
        <CardContent>
          {requests.length ? (
            <div className="space-y-4">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-col gap-4 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{request.full_name || "Unnamed educator"}</p>
                    <p className="text-sm text-muted-foreground">{request.email}</p>
                    <p className="text-sm text-muted-foreground">
                      Requested department: {request.requested_department}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Institutional domain: {request.requested_domain}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {new Date(request.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    className="min-h-11"
                    disabled={approveTeacherRequestMutation.isPending}
                    onClick={() => approveTeacherRequestMutation.mutate({ requestId: request.id })}
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Approve Teacher
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              type="no-results"
              title="No pending teacher requests"
              description="Educator requests will appear here once teachers submit verification requests."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <UserRoundSearch className="mt-0.5 h-5 w-5 text-primary" />
          <p>
            Use this queue for trust-based onboarding. Student registration remains automatic, while educator access
            must be reviewed and approved by an administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
