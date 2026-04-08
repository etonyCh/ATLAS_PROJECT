"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { adminApi } from "@/lib/api";
import { useImportTeachersMutation } from "@/queries/admin.queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { TeacherImportResult } from "@/types/api.types";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AdminTeacherImportPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const importMutation = useImportTeachersMutation();
  const [result, setResult] = useState<TeacherImportResult | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);

  const handleTemplateDownload = async () => {
    setTemplateLoading(true);
    try {
      const blob = await adminApi.downloadTeacherImportTemplate();
      downloadBlob(blob, "teacher_import_template.xlsx");
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const response = await importMutation.mutateAsync(formData);
    setResult(response);
    event.target.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Teacher Import</h1>
          <p className="text-muted-foreground">
            Use the CDC-aligned institutional onboarding flow: download the template, complete it,
            and batch import teacher accounts for activation.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            disabled={templateLoading}
            onClick={handleTemplateDownload}
          >
            {templateLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download Template
          </Button>
          <Button
            disabled={importMutation.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {importMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Import File
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How This Flow Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Download the template with the valid departments for your establishment.</p>
          <p>2. Fill in `email`, `full_name`, and `department_name` for each teacher.</p>
          <p>3. Import the file to create inactive teacher accounts and send onboarding invitations.</p>
          <p>4. Teachers activate access through the verification flow after receiving their invitation.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import Result</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {result ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{result.success_count}</p>
                    <p className="text-sm text-muted-foreground">Imported</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-amber-600">{result.duplicates.length}</p>
                    <p className="text-sm text-muted-foreground">Duplicates</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-red-600">{result.errors.length}</p>
                    <p className="text-sm text-muted-foreground">Errors</p>
                  </CardContent>
                </Card>
              </div>

              {result.duplicates.length ? (
                <div className="space-y-2">
                  <h2 className="font-medium">Duplicates</h2>
                  <div className="space-y-2">
                    {result.duplicates.map((item) => (
                      <div key={`${item.row}-${item.email}`} className="rounded-lg border p-3 text-sm">
                        Row {item.row}: {item.email}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {result.errors.length ? (
                <div className="space-y-2">
                  <h2 className="font-medium">Validation Errors</h2>
                  <div className="space-y-2">
                    {result.errors.map((item) => (
                      <div key={`${item.row}-${item.email}`} className="rounded-lg border p-3 text-sm">
                        <p>
                          Row {item.row}: {item.email}
                        </p>
                        <p className="text-muted-foreground">{item.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState
              type="no-results"
              title="No import run yet"
              description="Download the template, upload a CSV or XLSX file, and the import summary will appear here."
              icon={FileSpreadsheet}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
