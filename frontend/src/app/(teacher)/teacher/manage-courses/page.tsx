"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Eye, Loader2, Plus, Search, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function ManageCourses() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const itemsPerPage = 6;

  const { data: courses = [], isLoading } = useTeacherCourses();

  const mappedCourses = useMemo(
    () =>
      courses.map((course) => ({
        id: course.id,
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
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    Catalog course
                  </div>
                  <StatusChip status={course.status} />
                  <Button variant="outline" size="sm" onClick={() => setSelectedCourse(course)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
    </div>
  );
}
