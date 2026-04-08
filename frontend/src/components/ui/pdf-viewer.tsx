"use client";

import { useMemo } from "react";
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
  const fileSource = useMemo(() => {
    if (data instanceof Uint8Array) {
      // Validate that the Uint8Array has content
      if (data.byteLength === 0) {
        console.error("PDF data is empty (Uint8Array with 0 bytes)");
        return null;
      }
      return { data };
    }
    if (data instanceof ArrayBuffer) {
      // Validate that the ArrayBuffer has content
      if (data.byteLength === 0) {
        console.error("PDF data is empty (ArrayBuffer with 0 bytes)");
        return null;
      }
      return { data: new Uint8Array(data) };
    }
    if (url) {
      return url;
    }
    return null;
  }, [data, url]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    if (onLoadSuccess) {
      onLoadSuccess(numPages);
    }
  }

  return (
    <div className="flex justify-center bg-muted/30 p-4 border rounded-lg overflow-auto h-full w-full">
      {!fileSource ? (
        <div className="text-destructive text-center p-4">
          Failed to load PDF: File is empty or invalid.
        </div>
      ) : (
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
      )}
    </div>
  );
}
