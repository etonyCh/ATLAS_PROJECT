"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, Check, FileText, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { coursesApi } from "@/lib/api";
import { useCourseCatalogQuery } from "@/queries/courses";

export default function TeacherCourseUploadPage() {
  const router = useRouter();
  const uploadMutation = useMutation({
    mutationFn: (data: FormData) => coursesApi.upload(data),
  });
  const catalogQuery = useCourseCatalogQuery();

  const [file, setFile] = useState<File | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [courseType, setCourseType] = useState("LECTURE");
  const [language, setLanguage] = useState("FR");
  const [error, setError] = useState("");

  const selectedCourse = useMemo(
    () => (catalogQuery.data ?? []).find((course) => course.id === selectedCourseId),
    [catalogQuery.data, selectedCourseId],
  );

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!selectedCourseId) {
      setError("Please select a course from the administrator catalog.");
      return;
    }
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("course_id", selectedCourseId);
    formData.append("course_type", courseType);
    formData.append("language", language);
    formData.append("file", file);

    try {
      await uploadMutation.mutateAsync(formData);
      router.push("/teacher/manage-courses");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload Course Material</h1>
        <p className="text-muted-foreground">
          Teachers can only upload materials into administrator-configured courses.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Select Course</CardTitle>
                <CardDescription>Choose a course that already exists in the academic catalog.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error ? (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Course</label>
                  <select
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={selectedCourseId}
                    onChange={(event) => setSelectedCourseId(event.target.value)}
                    required
                  >
                    <option value="">Select a configured course</option>
                    {(catalogQuery.data ?? []).map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.title} - {course.filiere ?? course.department_name ?? "Department"} - {course.level ?? "-"}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCourse ? (
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                    <p className="font-medium">{selectedCourse.title}</p>
                    <p className="text-muted-foreground">
                      {selectedCourse.filiere ?? selectedCourse.department_name ?? "Department"} | {selectedCourse.level ?? "-"} | {selectedCourse.academic_year ?? "-"}
                    </p>
                    {selectedCourse.description ? <p className="mt-2 text-muted-foreground">{selectedCourse.description}</p> : null}
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Document Type</label>
                    <select
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      value={courseType}
                      onChange={(event) => setCourseType(event.target.value)}
                    >
                      <option value="LECTURE">Lecture Notes (Cours)</option>
                      <option value="TD">Worksheet (TD)</option>
                      <option value="TP">Lab (TP)</option>
                      <option value="EXAM">Exam/Quiz</option>
                      <option value="SUMMARY">Summary/Revision</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Language</label>
                    <select
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      value={language}
                      onChange={(event) => setLanguage(event.target.value)}
                    >
                      <option value="FR">French (Français)</option>
                      <option value="EN">English (Anglais)</option>
                      <option value="AR">Arabic (العربية)</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upload Document</CardTitle>
                <CardDescription>Supported formats: PDF, DOC, DOCX, PPT, PPTX, PNG, JPG, JPEG.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {file ? (
                  <div className="flex items-center gap-3 rounded-lg border p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setFile(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <FileDropzone
                    onFileSelect={handleFileSelect}
                    accept={{
                      "application/pdf": [".pdf"],
                      "application/msword": [".doc"],
                      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
                      "application/vnd.ms-powerpoint": [".ppt"],
                      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
                      "image/png": [".png"],
                      "image/jpeg": [".jpg", ".jpeg"],
                    }}
                  />
                )}
              </CardContent>
            </Card>

            <Button type="submit" className="w-full" disabled={uploadMutation.isPending || catalogQuery.isLoading}>
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Material
                </>
              )}
            </Button>
          </form>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Catalog Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p>Courses are created by administrators, not by teachers.</p>
              </div>
              <div className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p>Teachers upload materials only for catalog courses in their assigned department.</p>
              </div>
              <div className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p>Student contributions are reviewed by teachers, not admins.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
