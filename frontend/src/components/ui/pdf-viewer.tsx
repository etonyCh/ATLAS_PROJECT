"use client";

import { useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Loader2 } from "lucide-react";

// Use a local worker file so CSP-safe PDF rendering works in both admin and student flows.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PdfViewerProps {
  url?: string;
  data?: ArrayBuffer | Uint8Array | null;
  pageNumber: number;
  onLoadSuccess?: (numPages: number) => void;
}

export function PdfViewer({ url, data, pageNumber, onLoadSuccess }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);

  const fileSource = useMemo(() => {
    if (data instanceof Uint8Array) {
      return { data };
    }
    if (data instanceof ArrayBuffer) {
      return { data: new Uint8Array(data) };
    }
    return url;
  }, [data, url]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    if (onLoadSuccess) {
      onLoadSuccess(numPages);
    }
  }

  return (
    <div className="flex justify-center bg-muted/30 p-4 border rounded-lg overflow-auto h-full w-full">
      <Document
        file={fileSource}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
        error={
          <div className="text-destructive text-center p-4">
            Failed to load PDF.
          </div>
        }
      >
        <Page
          pageNumber={pageNumber}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          className="shadow-lg"
          width={800}
        />
      </Document>
    </div>
  );
}
