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
import { useTranslation } from "@/hooks/use-translation";

const CURRENT_ACADEMIC_YEAR = "2025-2026";

export default function TeacherCourseUploadPage() {
  const { t } = useTranslation();
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
      setError(t("teacher.uploadSelectCourseError"));
      return;
    }
    if (!file) {
      setError(t("teacher.uploadSelectFileError"));
      return;
    }

    const formData = new FormData();
    formData.append("course_id", selectedCourseId);
    formData.append("course_type", courseType);
    formData.append("language", language);
    formData.append("academic_year", CURRENT_ACADEMIC_YEAR);
    formData.append("file", file);

    try {
      await uploadMutation.mutateAsync(formData);
      router.push("/teacher/manage-courses");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("teacher.uploadFailed"));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("teacher.uploadCourseMaterial")}</h1>
        <p className="text-muted-foreground">
          {t("teacher.uploadDescription")}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("teacher.selectCourse")}</CardTitle>
                <CardDescription>{t("teacher.selectCourseDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error ? (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("course.course")}</label>
                  <select
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={selectedCourseId}
                    onChange={(event) => setSelectedCourseId(event.target.value)}
                    required
                  >
                    <option value="">{t("teacher.selectConfiguredCourse")}</option>
                    {(catalogQuery.data ?? []).map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.title} - {course.filiere ?? course.department_name ?? t("teacher.department")} - {course.level ?? "-"}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCourse ? (
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                    <p className="font-medium">{selectedCourse.title}</p>
                    <p className="text-muted-foreground">
                      {selectedCourse.filiere ?? selectedCourse.department_name ?? t("teacher.department")} | {selectedCourse.level ?? "-"} | {selectedCourse.academic_year ?? "-"}
                    </p>
                    {selectedCourse.description ? <p className="mt-2 text-muted-foreground">{selectedCourse.description}</p> : null}
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t("teacher.documentType")}</label>
                    <select
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      value={courseType}
                      onChange={(event) => setCourseType(event.target.value)}
                    >
                      <option value="LECTURE">{t("teacher.lectureNotes")} (Cours)</option>
                      <option value="TD">{t("teacher.worksheet")} (TD)</option>
                      <option value="TP">{t("teacher.lab")} (TP)</option>
                      <option value="EXAM">{t("teacher.exam")}</option>
                      <option value="SUMMARY">{t("teacher.summary")}</option>
                      <option value="OTHER">{t("ui.other")}</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t("account.language")}</label>
                    <select
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      value={language}
                      onChange={(event) => setLanguage(event.target.value)}
                    >
                      <option value="FR">{t("teacher.french")} (Français)</option>
                      <option value="EN">{t("teacher.english")} (Anglais)</option>
                      <option value="AR">{t("teacher.arabic")} (العربية)</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("teacher.uploadDocument")}</CardTitle>
                <CardDescription>{t("teacher.supportedFormatsDescription")}</CardDescription>
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
                  {t("teacher.uploading")}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {t("teacher.uploadMaterial")}
                </>
              )}
            </Button>
          </form>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("teacher.catalogRules")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p>{t("teacher.ruleAdminsCreateCourses")}</p>
              </div>
              <div className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p>{t("teacher.ruleTeachersUpload")}</p>
              </div>
              <div className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p>{t("teacher.ruleStudentReview")}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
