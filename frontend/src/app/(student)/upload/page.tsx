"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  Clock3,
  FileCheck2,
  FileText,
  Loader2,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileDropzone } from "@/components/ui/file-dropzone";
import {
  useContributorStatusQuery,
  useCoursesQuery,
  useSubmitContributionMutation,
  useSubmitContributorRequestMutation,
} from "@/queries";
import { useAuthStore } from "@/store/auth.store";

export default function UploadPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const contributorStatusQuery = useContributorStatusQuery();
  const coursesQuery = useCoursesQuery();
  const uploadMutation = useSubmitContributionMutation();
  const contributorRequestMutation = useSubmitContributorRequestMutation();

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState("");
  const [error, setError] = useState("");

  const contributorRequest = contributorStatusQuery.data?.request ?? null;
  const canUpload =
    Boolean(user?.is_contributor) ||
    Boolean(contributorStatusQuery.data?.is_contributor);
  const isPendingRequest = contributorRequest?.status === "PENDING";

  const modeLabel = canUpload
    ? "Submit Community Contribution"
    : "Request Contributor Access";
  const helperText = canUpload
    ? "Upload a document that will go through moderation before other students can see it."
    : "Submit one high-quality demo document. An admin reviews it before contributor upload access is unlocked.";

  const isBusy =
    uploadMutation.isPending ||
    contributorRequestMutation.isPending ||
    contributorStatusQuery.isLoading;

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      setFile(selectedFile);
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
      }
    },
    [title],
  );

  const handleRemoveFile = () => {
    setFile(null);
  };

  const sortedCourses = useMemo(
    () =>
      [...(coursesQuery.data || [])].sort((a, b) =>
        a.title.localeCompare(b.title),
      ),
    [coursesQuery.data],
  );

  const resetForm = () => {
    setFile(null);
    setTitle("");
    setDescription("");
    setCourseId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    if (!title.trim() || !courseId) {
      setError("Please fill in all required fields.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append("course_id", courseId);

    try {
      if (canUpload) {
        await uploadMutation.mutateAsync(formData);
        router.push("/my/contributions");
      } else {
        await contributorRequestMutation.mutateAsync(formData);
        await contributorStatusQuery.refetch();
        resetForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{modeLabel}</h1>
        <p className="text-muted-foreground">{helperText}</p>
      </div>

      {!canUpload && contributorRequest ? (
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {isPendingRequest ? (
                <>
                  <Clock3 className="h-5 w-5 text-amber-500" />
                  Contributor Request Pending
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  Contributor Request Result
                </>
              )}
            </CardTitle>
            <CardDescription>
              {isPendingRequest
                ? "Your demo document is waiting for admin review."
                : "You can review the previous decision below and submit a stronger document."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="font-medium">{contributorRequest.demo_contribution.title}</p>
              <p className="mt-1 text-muted-foreground">
                Submitted on{" "}
                {new Date(contributorRequest.created_at).toLocaleString()}
              </p>
              <p className="mt-2 text-muted-foreground">
                OCR quality score:{" "}
                {Number(contributorRequest.ocr_quality_score || 0).toFixed(2)}
              </p>
            </div>
            {contributorRequest.review_note ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive">
                <p className="font-medium">Reviewer feedback</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {contributorRequest.review_note}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isPendingRequest && !canUpload ? null : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{modeLabel}</CardTitle>
                  <CardDescription>{helperText}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {error ? (
                    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      {error}
                    </div>
                  ) : null}

                  {file ? (
                    <div className="flex items-center gap-3 rounded-lg border p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleRemoveFile}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <FileDropzone
                      onFileSelect={handleFileSelect}
                      accept={{
                        "application/pdf": [".pdf"],
                        "application/msword": [".doc"],
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                          [".docx"],
                        "application/vnd.ms-powerpoint": [".ppt"],
                        "application/vnd.openxmlformats-officedocument.presentationml.presentation":
                          [".pptx"],
                        "image/png": [".png"],
                        "image/jpeg": [".jpg", ".jpeg"],
                      }}
                    />
                  )}

                  <Input
                    label="Title"
                    placeholder="Document title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Description
                    </label>
                    <textarea
                      className="min-h-[110px] w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      placeholder={
                        canUpload
                          ? "Describe what this contribution contains..."
                          : "Explain why this demo document shows you can contribute quality academic content..."
                      }
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Course <span className="text-destructive">*</span>
                    </label>
                    <select
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      value={courseId}
                      onChange={(e) => setCourseId(e.target.value)}
                      required
                    >
                      <option value="">Select a course</option>
                      {sortedCourses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </CardContent>
              </Card>

              <Button type="submit" className="w-full" disabled={isBusy}>
                {isBusy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : canUpload ? (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Submit Contribution
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Send Contributor Request
                  </>
                )}
              </Button>
            </form>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <p>Every student can request contributor access.</p>
              </div>
              <div className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <p>Admins review one demo document before unlocking uploads.</p>
              </div>
              <div className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <p>Approved contributors keep using the same page for normal uploads.</p>
              </div>
              <div className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <p>Other students only see your file after moderation approval.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Accepted Files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex gap-2">
                <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>PDF, DOC, DOCX, PPT, PPTX, PNG, JPG, JPEG</p>
              </div>
              <div className="flex gap-2">
                <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>Maximum file size: 50 MB</p>
              </div>
              <div className="flex gap-2">
                <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>OCR quality and clarity are part of the review.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
