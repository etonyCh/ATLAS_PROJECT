"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Plus,
  Search,
  Users,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusChip } from "@/components/ui/status-chip";
import { useTeacherCourses, useDeleteCourseMutation, useUpdateCourseMutation } from "@/queries/courses";

type ModalType = "view" | "edit" | "delete" | null;

export default function ManageCourses() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({ title: "", description: "", filiere: "", level: "" });

  const { data: courses = [], isLoading } = useTeacherCourses();
  const deleteMutation = useDeleteCourseMutation();
  const updateMutation = useUpdateCourseMutation();

  const openModal = (type: ModalType, course: any) => {
    setSelectedCourse(course);
    if (type === "edit") {
      setEditFormData({
        title: course.title || "",
        description: course.description || "",
        filiere: course.filiere === "General" ? "" : (course.filiere || ""),
        level: course.level === "-" ? "" : (course.level || ""),
      });
    }
    setActiveModal(type);
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedCourse(null);
  };

  const handleDelete = () => {
    if (selectedCourse) {
      console.log("🟡 Delete clicked:", selectedCourse.id);
      deleteMutation.mutate(selectedCourse.id, {
        onSuccess: (data) => {
          console.log("🟢 Deleted:", data ?? selectedCourse.id);
          closeModal();
        },
        onError: (err) => {
          console.error("🔴 Delete error:", err);
          alert("Failed to delete the course");
        }
      });
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCourse) {
      updateMutation.mutate({
        courseId: selectedCourse.id,
        data: editFormData
      }, {
        onSuccess: () => {
          closeModal();
        },
        onError: () => {
          alert("Failed to update the course");
        }
      });
    }
  };

  const mappedCourses = courses.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    code: "CRS-" + c.id.slice(0, 4).toUpperCase(),
    students: 0,
    status: c.is_deleted ? "archived" : "active",
    filiere: c.filiere || "General",
    level: c.level || "-",
  }));

  const filteredCourses = mappedCourses.filter((course) => {
    const matchesSearch =
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || course.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredCourses.length / itemsPerPage);
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
          <h1 className="text-2xl font-bold">Manage Courses</h1>
          <p className="text-muted-foreground">
            Create and manage your teaching courses
          </p>
        </div>
        <Button asChild>
          <Link href="/teacher/courses/upload">
            <Plus className="mr-2 h-4 w-4" />
            Create Course
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border bg-background px-4 py-2 text-sm"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
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
                      {course.code} • {course.filiere} • {course.level}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {course.students} students
                  </div>
                  <StatusChip status={course.status} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="cursor-pointer" onClick={() => openModal("view", course)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer" onClick={() => openModal("edit", course)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Course
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive cursor-pointer" onClick={() => openModal("delete", course)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, filteredCourses.length)} of{" "}
            {filteredCourses.length} courses
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

      <Dialog open={activeModal !== null} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-[425px]">
          {activeModal === "delete" && selectedCourse && (
            <>
              <DialogHeader>
                <DialogTitle>Delete Course</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete the course &quot;{selectedCourse.title}&quot;? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={closeModal} disabled={deleteMutation.isPending}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
                  {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Delete
                </Button>
              </DialogFooter>
            </>
          )}

          {activeModal === "view" && selectedCourse && (
            <>
              <DialogHeader>
                <DialogTitle>Course Details</DialogTitle>
                <DialogDescription>
                  Review the details for &quot;{selectedCourse.title}&quot;
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <span className="text-sm font-medium text-muted-foreground">Title</span>
                  <span className="col-span-3 text-sm font-medium">{selectedCourse.title}</span>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <span className="text-sm font-medium text-muted-foreground">Code</span>
                  <span className="col-span-3 text-sm font-medium">{selectedCourse.code}</span>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <span className="text-sm font-medium text-muted-foreground">Filiere</span>
                  <span className="col-span-3 text-sm font-medium">{selectedCourse.filiere}</span>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <span className="text-sm font-medium text-muted-foreground">Level</span>
                  <span className="col-span-3 text-sm font-medium">{selectedCourse.level}</span>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <span className="text-sm font-medium text-muted-foreground">Students</span>
                  <span className="col-span-3 text-sm font-medium">{selectedCourse.students}</span>
                </div>
                {selectedCourse.description && (
                  <div className="grid gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Description</span>
                    <p className="text-sm text-muted-foreground">{selectedCourse.description}</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={closeModal}>Close</Button>
                <Button variant="outline" asChild>
                  <Link href={`/courses/${selectedCourse.id}`}>View public page</Link>
                </Button>
              </DialogFooter>
            </>
          )}

          {activeModal === "edit" && selectedCourse && (
            <form onSubmit={handleEditSubmit}>
              <DialogHeader>
                <DialogTitle>Edit Course</DialogTitle>
                <DialogDescription>
                  Make changes to your course &quot;{selectedCourse.title}&quot; here.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <label htmlFor="title" className="text-sm font-medium text-muted-foreground">Title</label>
                  <Input
                    id="title"
                    value={editFormData.title}
                    onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                    placeholder="Enter course title"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="description" className="text-sm font-medium text-muted-foreground">Description</label>
                  <Textarea
                    id="description"
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    placeholder="Enter a brief description..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label htmlFor="filiere" className="text-sm font-medium text-muted-foreground">Filiere</label>
                    <Input
                      id="filiere"
                      value={editFormData.filiere}
                      disabled
                      title="Filiere is determined by the Department and cannot be edited directly."
                      onChange={(e) => setEditFormData({ ...editFormData, filiere: e.target.value })}
                      placeholder="e.g. Informatique"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="level" className="text-sm font-medium text-muted-foreground">Level</label>
                    <Input
                      id="level"
                      value={editFormData.level}
                      onChange={(e) => setEditFormData({ ...editFormData, level: e.target.value })}
                      placeholder="e.g. L3"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeModal} disabled={updateMutation.isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
