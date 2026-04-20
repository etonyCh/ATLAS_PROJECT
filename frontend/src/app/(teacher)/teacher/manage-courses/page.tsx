"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, ExternalLink, Eye, Loader2, Plus, Search, Trash2, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { contributionsApi, filesApi } from "@/lib/api";
import { PDFPreviewer } from "@/components/ui/pdf-previewer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusChip } from "@/components/ui/status-chip";
import { useTeacherCourses } from "@/queries/courses";
import { MaterialSelectionDialog } from "@/components/course/material-selection-dialog";

export default function ManageCourses() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [courseToDelete, setCourseToDelete] = useState<any>(null);
  const [previewContributionId, setPreviewContributionId] = useState<string | null>(null);
  const [materialSelectionCourse, setMaterialSelectionCourse] = useState<{id: string, title: string} | null>(null);
  const itemsPerPage = 6;
  
  const deleteMutation = useMutation({
    mutationFn: (id: string) => contributionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses", "my-uploads"] });
      setCourseToDelete(null);
    },
  });

  const { data: courses = [], isLoading } = useTeacherCourses();

  const mappedCourses = useMemo(
    () =>
      courses.map((course) => ({
        id: course.id,
        contributionId: (course as any).contribution_id,
        title: course.title,
        description: course.description,
        filiere: course.filiere || course.department_name || "Department",
        level: course.level || "-",
        status: course.is_deleted ? "archived" : "active",
      })),
    [courses],
  );

  const filteredCourses = mappedCourses.filter((course) =>
    course.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / itemsPerPage));
  const paginatedCourses = filteredCourses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Course Materials</h1>
          <p className="text-muted-foreground">
            These are the administrator-managed courses where you have uploaded materials.
          </p>
        </div>
        <Button asChild>
          <Link href="/teacher/courses/upload">
            <Plus className="mr-2 h-4 w-4" />
            Upload Material
          </Link>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search your course uploads..."
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setCurrentPage(1);
          }}
          className="pl-10"
        />
      </div>

      <div className="grid gap-4">
        {paginatedCourses.map((course) => (
          <Card key={course.id}>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <BookOpen className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{course.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {course.filiere} | {course.level}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground hidden lg:flex">
                    <Users className="h-4 w-4" />
                    Catalog course
                  </div>
                  <StatusChip status={course.status} />
                  <Button variant="outline" size="sm" onClick={() => setMaterialSelectionCourse({ id: course.id, title: course.title })}>
                    <Eye className="mr-2 h-4 w-4" />
                    Manage Materials
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSelectedCourse(course)}>
                    Details
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setCourseToDelete(course)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!courseToDelete} onOpenChange={(open) => !open && setCourseToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Uploaded Material?</DialogTitle>
            <DialogDescription>
              This will permanently delete your uploaded material for <strong>{courseToDelete?.title}</strong>. This action cannot be undone, and the material will be removed from search and storage.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCourseToDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!courseToDelete?.contributionId) return;
                deleteMutation.mutate(courseToDelete.contributionId);
              }}
              disabled={deleteMutation.isPending || !courseToDelete?.contributionId}
            >
              {deleteMutation.isPending ? "Deleting..." : "Permanently Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {filteredCourses.length > itemsPerPage ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, filteredCourses.length)} of {filteredCourses.length} courses
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled>
              {currentPage}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={!!selectedCourse} onOpenChange={(open) => !open && setSelectedCourse(null)}>
        <DialogContent>
          {selectedCourse ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedCourse.title}</DialogTitle>
                <DialogDescription>Administrator-managed catalog course</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2 text-sm">
                <p><strong>Department:</strong> {selectedCourse.filiere}</p>
                <p><strong>Level:</strong> {selectedCourse.level}</p>
                <p><strong>Status:</strong> {selectedCourse.status}</p>
                {selectedCourse.description ? <p>{selectedCourse.description}</p> : null}
              </div>
              <DialogFooter>
                <Button onClick={() => setSelectedCourse(null)}>Close</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <MaterialSelectionDialog
        isOpen={!!materialSelectionCourse}
        courseId={materialSelectionCourse?.id || null}
        courseTitle={materialSelectionCourse?.title}
        onClose={() => setMaterialSelectionCourse(null)}
      />

      <Dialog open={!!previewContributionId} onOpenChange={(open) => !open && setPreviewContributionId(null)}>
        <DialogContent className="max-w-[95vw] lg:max-w-[85vw] h-[90vh] p-0 overflow-hidden border-none shadow-2xl">
          {previewContributionId && (
            <div className="flex h-full flex-col overflow-hidden rounded-lg">
              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
                <h3 className="font-semibold text-sm">Document Preview</h3>
                <Button variant="ghost" size="sm" onClick={() => setPreviewContributionId(null)}>Close</Button>
              </div>
              <div className="flex-1 overflow-hidden">
                <PDFPreviewer
                  storagePath={previewContributionId}
                  onRequestPresignedUrl={(id) => filesApi.getPreviewUrl(id).then(r => r.url)}
                  title="Course Material"
                  className="rounded-none border-none"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
