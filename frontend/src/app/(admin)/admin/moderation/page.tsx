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
  ShieldAlert,
  ShieldCheck,
  FileUp,
  XCircle,
} from "lucide-react";
import { adminApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import { FilePreview } from "@/components/ui/file-preview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAdminContributionsQuery,
  useAdminContributorRequestsQuery,
  useApproveContributionMutation,
  useApproveContributorRequestMutation,
  useRejectContributionMutation,
  useRejectContributorRequestMutation,
} from "@/queries/contributions";
import type { Contribution, ContributorRequest } from "@/types/api.types";

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

// ----------------------------------------------------------------------
// Reports Tab Component
// ----------------------------------------------------------------------
function ReportsTab() {
  const [status, setStatus] = useState<(typeof statusOptions)[number]["value"]>("PENDING");
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
      queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
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
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((option) => (
            <Button
              key={option.value}
              variant={status === option.value ? "default" : "outline"}
              onClick={() => setStatus(option.value)}
              className="min-h-11 shadow-sm"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="shadow-sm">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Reports</p>
              <p className="mt-2 text-2xl font-bold">{stats.total}</p>
            </div>
            <FileText className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="mt-2 text-2xl font-bold">{stats.pending}</p>
            </div>
            <Clock3 className="h-5 w-5 text-amber-500" />
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Resolved</p>
              <p className="mt-2 text-2xl font-bold">{stats.resolved}</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Critical</p>
              <p className="mt-2 text-2xl font-bold">{stats.critical}</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-t-4 border-t-primary shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30">
          <CardTitle className="text-lg">Incident Log</CardTitle>
          <CardDescription>All user feedback, bugs, and flagged content</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {reportsQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((key) => (
                <Skeleton key={key} className="h-36 w-full" />
              ))}
            </div>
          ) : reportsQuery.data?.items.length ? (
            <div className="space-y-4">
              {reportsQuery.data.items.map((report) => (
                <div
                  key={report.id}
                  className="rounded-xl border border-border/50 bg-background p-5 shadow-sm transition-all hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusChip
                          status={report.is_resolved ? "approved" : "pending"}
                          label={report.is_resolved ? "Resolved" : "Active"}
                        />
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                          {formatType(report.type)}
                        </span>
                        {report.severity && (
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${report.severity.toLowerCase() === 'critical' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                            {formatSeverity(report.severity)}
                          </span>
                        )}
                      </div>

                      <div>
                        <h2 className="text-lg font-semibold tracking-tight">{report.title}</h2>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                          {report.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-4 text-xs font-medium text-muted-foreground/80">
                        <span className="flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          {new Date(report.created_at).toLocaleString()}
                        </span>
                        {report.screenshot_url && (
                          <a
                            href={report.screenshot_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline hover:text-primary/80 transition-colors"
                          >
                            View screenshot
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                      {!report.is_resolved && (
                        <Button
                          className="min-h-11 shadow-sm transition-all"
                          disabled={resolveReportMutation.isPending}
                          onClick={() => resolveReportMutation.mutate(report.id)}
                        >
                          Mark as Resolved
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              type="no-data"
              title="Inbox Zero!"
              description="There are no system reports currently in this queue."
              icon={MessageSquareWarning}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}


// ----------------------------------------------------------------------
// Contributions Tab Component
// ----------------------------------------------------------------------
function ContributionsTab() {
  type PreviewDocument = Contribution | ContributorRequest["demo_contribution"];

  const [rejectionDialog, setRejectionDialog] = useState<{
    open: boolean;
    targetId: string | null;
    targetType: "contribution" | "contributor_request" | null;
  }>({ open: false, targetId: null, targetType: null });
  const [rejectionReason, setRejectionReason] = useState("");
  const [previewDialog, setPreviewDialog] = useState<{
    open: boolean;
    doc: PreviewDocument | null;
    targetType: "contribution" | "contributor_request" | null;
    targetId: string | null;
  }>({ open: false, doc: null, targetType: null, targetId: null });

  const queueQuery = useAdminContributionsQuery({ status: "PENDING" });
  const contributorRequestsQuery = useAdminContributorRequestsQuery({
    status: "PENDING",
  });
  const approveMutation = useApproveContributionMutation();
  const rejectMutation = useRejectContributionMutation();
  const approveContributorMutation = useApproveContributorRequestMutation();
  const rejectContributorMutation = useRejectContributorRequestMutation();

  const handleApprove = (id: string) => {
    approveMutation.mutate({ contributionId: id });
  };

  const handleApproveContributorRequest = (id: string) => {
    approveContributorMutation.mutate({ requestId: id });
  };

  const submitRejection = () => {
    if (rejectionDialog.targetId && rejectionReason.trim()) {
      if (rejectionDialog.targetType === "contributor_request") {
        rejectContributorMutation.mutate({
          requestId: rejectionDialog.targetId,
          reviewNote: rejectionReason,
        });
      } else {
        rejectMutation.mutate({
          contributionId: rejectionDialog.targetId,
          reviewNote: rejectionReason,
        });
      }
      setRejectionDialog({ open: false, targetId: null, targetType: null });
      setRejectionReason("");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-t-4 border-t-sky-500 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30">
          <CardTitle className="text-lg">Contributor Access Requests</CardTitle>
          <CardDescription>
            Review demo documents before unlocking student upload privileges.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {contributorRequestsQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : contributorRequestsQuery.data?.items.length ? (
            <div className="grid gap-4">
              {contributorRequestsQuery.data.items.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-col gap-4 rounded-xl border p-5 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">
                        {request.full_name || request.email}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <StatusChip status="pending" label="Contributor Request" />
                        <span>{request.demo_contribution.title}</span>
                        <span>OCR {Number(request.ocr_quality_score || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="shadow-sm"
                      onClick={() =>
                        setPreviewDialog({
                          open: true,
                          targetType: "contributor_request",
                          targetId: request.id,
                          doc: {
                            ...request.demo_contribution,
                            s3_key: request.demo_contribution.s3_key,
                            mime_type: request.demo_contribution.mime_type,
                            preview_text: request.demo_contribution.preview_text,
                            created_at: request.demo_contribution.created_at,
                          },
                        })
                      }
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      View Demo
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="shadow-sm"
                      onClick={() =>
                        setRejectionDialog({
                          open: true,
                          targetId: request.id,
                          targetType: "contributor_request",
                        })
                      }
                      disabled={rejectContributorMutation.isPending}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                      onClick={() => handleApproveContributorRequest(request.id)}
                      disabled={
                        approveContributorMutation.isPending ||
                        rejectContributorMutation.isPending
                      }
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Approve Access
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              type="no-data"
              title="No contributor requests pending"
              description="Student contributor applications will appear here for review."
              icon={ShieldCheck}
            />
          )}
        </CardContent>
      </Card>

      <Card className="border-t-4 border-t-amber-500 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30">
          <CardTitle className="text-lg">Pending Contributions Queue</CardTitle>
          <CardDescription>Review community uploads before they hit the vector database.</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {queueQuery.isLoading ? (
            <div className="space-y-3">
               <Skeleton className="h-24 w-full" />
               <Skeleton className="h-24 w-full" />
            </div>
          ) : queueQuery.data?.items.length ? (
            <div className="grid gap-4">
              {queueQuery.data.items.map((doc) => (
                <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex gap-4 items-center">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                       <FileUp className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{doc.title}</h3>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <StatusChip status="pending" label="Awaiting Review" />
                        <span>|</span>
                        {new Date(doc.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="shadow-sm"
                      onClick={() =>
                        setPreviewDialog({
                          open: true,
                          doc,
                          targetId: doc.id,
                          targetType: "contribution",
                        })
                      }
                    >
                      <FileText className="h-4 w-4 mr-2" /> View Document
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      className="shadow-sm"
                      onClick={() =>
                        setRejectionDialog({
                          open: true,
                          targetId: doc.id,
                          targetType: "contribution",
                        })
                      }
                      disabled={rejectMutation.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-2" /> Reject
                    </Button>
                    <Button 
                      size="sm" 
                      className="shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleApprove(doc.id)}
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              type="no-data"
              title="All caught up!"
              description="No user contributions are currently awaiting moderation."
              icon={CheckCircle2}
            />
          )}
        </CardContent>
      </Card>

      {/* Reject Modal */}
      <Dialog
        open={rejectionDialog.open}
        onOpenChange={(val) =>
          !val &&
          setRejectionDialog({
            open: false,
            targetId: null,
            targetType: null,
          })
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {rejectionDialog.targetType === "contributor_request"
                ? "Reject Contributor Request"
                : "Reject Contribution"}
            </DialogTitle>
            <DialogDescription>
              Please provide a reason. This feedback will be sent back to the uploader.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <textarea 
              autoFocus
              className="block w-full rounded-md border-border bg-background p-3 text-sm shadow-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary"
              rows={4}
              placeholder="e.g. The document is illegible, off-topic, or violates community guidelines."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          </div>
          <DialogFooter className="sm:justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setRejectionDialog({
                  open: false,
                  targetId: null,
                  targetType: null,
                })
              }
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={submitRejection}
              disabled={
                !rejectionReason.trim() ||
                rejectMutation.isPending ||
                rejectContributorMutation.isPending
              }
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SOTA Preview Modal */}
      <Dialog
        open={previewDialog.open}
        onOpenChange={(val) =>
          !val &&
          setPreviewDialog({
            open: false,
            doc: null,
            targetType: null,
            targetId: null,
          })
        }
      >
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden bg-background">
          <div className="flex justify-between items-center p-4 border-b">
            <div>
              <DialogTitle className="text-xl">{previewDialog.doc?.title}</DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-2">
                <StatusChip status="pending" label="Pending Moderation" />
                <span>Uploaded {previewDialog.doc && new Date(previewDialog.doc.created_at).toLocaleDateString()}</span>
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => {
                  setPreviewDialog({
                    open: false,
                    doc: null,
                    targetType: null,
                    targetId: null,
                  });
                  setRejectionDialog({
                    open: true,
                    targetId: previewDialog.targetId,
                    targetType: previewDialog.targetType,
                  });
                }}
              >
                <XCircle className="h-4 w-4 mr-2" /> Reject
              </Button>
              <Button 
                size="sm" 
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  if (previewDialog.targetType === "contributor_request" && previewDialog.targetId) {
                    handleApproveContributorRequest(previewDialog.targetId);
                  } else if (previewDialog.doc) {
                    handleApprove(previewDialog.doc.id);
                  }
                  setPreviewDialog({
                    open: false,
                    doc: null,
                    targetId: null,
                    targetType: null,
                  });
                }}
                disabled={approveMutation.isPending || approveContributorMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {previewDialog.targetType === "contributor_request"
                  ? "Approve Access"
                  : "Approve Now"}
              </Button>
            </div>
          </div>
          
          <div className="flex-1 bg-muted/20 relative w-full h-full p-4 overflow-hidden">
            <FilePreview
              storagePath={previewDialog.doc?.s3_key}
              mimeType={previewDialog.doc?.mime_type}
              title={previewDialog.doc?.title}
              previewText={previewDialog.doc?.preview_text}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ----------------------------------------------------------------------
// Main Page Layout
// ----------------------------------------------------------------------
export default function ModerationHubPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animation-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <ShieldAlert className="h-8 w-8 text-primary" />
          Moderation Hub
        </h1>
        <p className="text-muted-foreground mt-2">
          Central command for safeguarding community content and investigating system reports.
        </p>
      </div>

      <Tabs defaultValue="contributions" className="w-full space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2 rounded-xl p-1 bg-muted/50 border shadow-sm">
          <TabsTrigger value="contributions" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
             Contributions
          </TabsTrigger>
          <TabsTrigger value="reports" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
             System Reports
          </TabsTrigger>
        </TabsList>
        <TabsContent value="contributions" className="outline-none focus:ring-0">
          <ContributionsTab />
        </TabsContent>
        <TabsContent value="reports" className="outline-none focus:ring-0">
          <ReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
