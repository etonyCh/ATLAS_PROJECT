"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Eye,
  FileText,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/status-chip";
import { FilePreview } from "@/components/ui/file-preview";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { contributionsApi } from "@/lib/api";
import type { Contribution } from "@/types/api.types";

const typeIcons: Record<string, typeof BookOpen> = {
  quiz: FileText,
  flashcard: BookOpen,
  summary: FileText,
  mindmap: FileText,
  course_material: BookOpen,
};

const typeLabels: Record<string, string> = {
  quiz: "Quiz",
  flashcard: "Flashcards",
  summary: "Summary",
  mindmap: "Mind Map",
  course_material: "Material",
};

export default function ManageContributions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const itemsPerPage = 5;

  const queryClient = useQueryClient();

  const queryParams = {
    limit: 50, 
    offset: 0,
    ...(statusFilter !== "all" && { status: statusFilter.toUpperCase() }),
  };

  const { data: response, isLoading } = useQuery({
    queryKey: ["admin_contributions", queryParams],
    queryFn: () => contributionsApi.admin.list(queryParams),
  });

  const contributions = response?.items || [];

  const filteredContributions = contributions.filter((contribution) => {
    const matchesSearch =
      contribution.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contribution.uploader_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || typeFilter === "course_material";
    return matchesSearch && matchesType;
  });

  const totalPages = Math.ceil(filteredContributions.length / itemsPerPage) || 1;
  const paginatedContributions = filteredContributions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const pendingCount = contributions.filter(
    (c) => c.status === "PENDING",
  ).length;

  const approveMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      return contributionsApi.admin.approve(id, { review_note: note });
    },
    onSuccess: () => {
      alert("Contribution Approved");
      queryClient.invalidateQueries({ queryKey: ["admin_contributions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "teacher"] });
      setSelectedContribution(null);
      setReviewNote("");
    },
    onError: (error: Error) => {
      alert(`Action failed: ${error.message}`);
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      return contributionsApi.admin.reject(id, note);
    },
    onSuccess: () => {
      alert("Contribution Rejected");
      queryClient.invalidateQueries({ queryKey: ["admin_contributions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "teacher"] });
      setSelectedContribution(null);
      setReviewNote("");
    },
    onError: (error: Error) => {
      alert(`Action failed: ${error.message}`);
    }
  });

  const handleApprove = () => {
    if (!selectedContribution) return;
    approveMutation.mutate({ id: selectedContribution.id, note: reviewNote });
  };

  const handleReject = () => {
    if (!selectedContribution) return;
    if (!reviewNote.trim()) {
      alert("Review note required: You must provide a reason for rejection.");
      return;
    }
    rejectMutation.mutate({ id: selectedContribution.id, note: reviewNote });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Review Student Contributions</h1>
          <p className="text-muted-foreground">
            Review, preview, approve, or reject student submissions for your department.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-amber-100 px-4 py-2 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          <Clock className="h-5 w-5" />
          <span className="font-medium">{isLoading ? "---" : pendingCount} pending reviews</span>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search titles or authors..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="pl-10"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
          className="rounded-lg border bg-background px-4 py-2 text-sm"
        >
          <option value="all">All Types</option>
          <option value="quiz">Quiz</option>
          <option value="flashcard">Flashcards</option>
          <option value="summary">Summary</option>
          <option value="mindmap">Mind Map</option>
          <option value="course_material">Material</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="rounded-lg border bg-background px-4 py-2 text-sm"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex h-[300px] items-center justify-center border rounded-lg">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4">
          {paginatedContributions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border rounded-lg bg-card border-dashed">
              No contributions match your filters.
            </div>
          ) : (
            paginatedContributions.map((contribution) => {
              const typeStr = "course_material";
              const TypeIcon = typeIcons[typeStr] || FileText;
              const uploaderName = contribution.uploader_id || "Unknown Student";
              
              return (
                <Card key={contribution.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                          <TypeIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{contribution.title}</h3>
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                              {typeLabels[typeStr] || "Material"}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            by {uploaderName} • {new Date(contribution.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusChip status={contribution.status} />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedContribution(contribution)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Review
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, filteredContributions.length)}{" "}
            of {filteredContributions.length} contributions
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={!!selectedContribution}
        onOpenChange={(open) => !open && setSelectedContribution(null)}
      >
        <DialogContent className="max-w-5xl h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Review Student Contribution</DialogTitle>
            <DialogDescription>
              Preview the uploaded file before you approve or reject it.
            </DialogDescription>
          </DialogHeader>
          {selectedContribution && (
            <div className="flex h-full flex-col gap-4 overflow-hidden">
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold">{selectedContribution.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  by {selectedContribution.uploader_id} 
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    Material
                  </span>
                  <StatusChip status={selectedContribution.status} />
                </div>
              </div>

              <div>
                <h4 className="font-medium">Description</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedContribution.description || "No description provided."}
                </p>
              </div>

              {selectedContribution.status === "REJECTED" && selectedContribution.review_note ? (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                  <h4 className="font-medium text-destructive">
                    Previous Rejection Reason
                  </h4>
                  <p className="mt-1 text-sm">
                    {selectedContribution.review_note}
                  </p>
                </div>
              ) : null}

              <div className="min-h-0 flex-1 overflow-auto">
                <FilePreview
                  storagePath={selectedContribution.s3_key}
                  mimeType={selectedContribution.mime_type}
                  title={selectedContribution.title}
                  previewText={selectedContribution.preview_text}
                />
              </div>

              {selectedContribution.status === "PENDING" ? (
                <div>
                  <label className="font-medium">Review Note</label>
                  <Textarea
                    placeholder="Add a note for the contributor (required for rejection)..."
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    className="mt-2"
                    rows={3}
                  />
                </div>
              ) : null}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={handleReject}
              disabled={selectedContribution?.status !== "PENDING" || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
              Reject
            </Button>
            <Button
              onClick={handleApprove}
              disabled={selectedContribution?.status !== "PENDING" || approveMutation.isPending}
            >
              {approveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
