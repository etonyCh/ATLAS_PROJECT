"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, X, Loader2, Check, AlertCircle } from "lucide-react";
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
import { coursesApi } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";

const LEVELS = ["L1", "L2", "L3", "M1", "M2", "OTHER"];
const LANGUAGES = ["FR", "EN", "AR"];

export default function ContributePage() {
  const router = useRouter();
  const uploadMutation = useMutation({
    mutationFn: (data: FormData) => coursesApi.upload(data),
  });
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("L1");
  const [courseType, setCourseType] = useState("LECTURE");
  const [academicYear, setAcademicYear] = useState("2024-2025");
  const [language, setLanguage] = useState("FR");
  const [error, setError] = useState("");

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!file) {
      setError("Please select a file to upload");
      return;
    }

    if (!title || !level || !academicYear) {
      setError("Please fill in all required fields");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    if (description) formData.append("description", description);
    formData.append("level", level);
    formData.append("course_type", courseType);
    formData.append("academic_year", academicYear);
    formData.append("language", language);

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
        <h1 className="text-2xl font-bold">Contribute</h1>
        <p className="text-muted-foreground">
          Share your knowledge with the community
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload Document</CardTitle>
                <CardDescription>
                  Share course materials, tutorials, or study guides
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}

                {file ? (
                  <div className="flex items-center gap-3 rounded-lg border p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
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
                  <label className="text-sm font-medium">Description</label>
                  <textarea
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[100px] resize-none"
                    placeholder="Describe the document..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Level <span className="text-destructive">*</span>
                    </label>
                    <select
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      required
                    >
                      {LEVELS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Type</label>
                    <select
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      value={courseType}
                      onChange={(e) => setCourseType(e.target.value)}
                    >
                      <option value="LECTURE">Course (Lecture)</option>
                      <option value="TD">TD (Tutorial)</option>
                      <option value="TP">TP (Lab)</option>
                      <option value="EXAM">Exam</option>
                      <option value="SUMMARY">Summary</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Academic Year <span className="text-destructive">*</span>
                    </label>
                    <Input
                      placeholder="e.g. 2024-2025"
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Language</label>
                    <select
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              type="submit"
              className="w-full"
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Submit Contribution
                </>
              )}
            </Button>
          </form>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex gap-2">
                <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                <p>Use clear, descriptive titles</p>
              </div>
              <div className="flex gap-2">
                <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                <p>Include the correct filiere and level</p>
              </div>
              <div className="flex gap-2">
                <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                <p>Supported formats: PDF, DOC, DOCX, PPT, PPTX, PNG, JPG, JPEG</p>
              </div>
              <div className="flex gap-2">
                <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                <p>Maximum file size: 50 MB</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reward Points</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">+50</p>
                <p className="text-sm text-muted-foreground">
                  XP per approved contribution
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
