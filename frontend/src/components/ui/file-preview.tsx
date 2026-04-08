"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Download, ExternalLink, FileText, Loader2, Presentation, FileImage } from "lucide-react";
import { getAccessToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { filesApi } from "@/lib/api";
import { renderAsync } from "docx-preview";
import { pptxToHtml } from "@jvmr/pptx-to-html";

interface FilePreviewProps {
  storagePath?: string | null;
  mimeType?: string | null;
  title?: string | null;
  previewText?: string | null;
}

function encodeStoragePath(storagePath: string) {
  return storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function getFileCategory(mimeType?: string | null) {
  if (!mimeType) return "unknown";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("text/")) return "text";
  if (mimeType.includes("officedocument.wordprocessingml")) return "docx";
  if (mimeType.includes("presentationml")) return "pptx";
  if (
    mimeType.includes("word")
  ) {
    return "word-legacy";
  }
  if (
    mimeType.includes("powerpoint")
  ) {
    return "powerpoint-legacy";
  }
  return "unknown";
}

export function FilePreview({
  storagePath,
  mimeType,
  title,
  previewText,
}: FilePreviewProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [resolvedMimeType, setResolvedMimeType] = useState<string | null>(mimeType || null);
  const [pptxSlidesHtml, setPptxSlidesHtml] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRenderingDocx, setIsRenderingDocx] = useState(false);
  const [isRenderingPptx, setIsRenderingPptx] = useState(false);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const docxContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!storagePath) {
      setBlobUrl(null);
      setFileBuffer(null);
      setPptxSlidesHtml([]);
      setError(null);
      return;
    }

    let isMounted = true;
    let objectUrl: string | null = null;
    const controller = new AbortController();

    const loadFile = async () => {
      console.log("[FilePreview] Loading file for storagePath:", storagePath);
      setIsLoading(true);
      setError(null);

      try {
        const token = getAccessToken();
        const url = `/api/files/proxy/${encodeStoragePath(storagePath)}`;
        console.log("[FilePreview] Fetching from:", url);
        
        const response = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });

        console.log("[FilePreview] Response status:", response.status);

        if (!response.ok) {
          throw new Error(`Unable to load preview (${response.status})`);
        }

        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();
        
        console.log("[FilePreview] Got blob, size:", blob.size, "type:", blob.type);
        
        // Validate that we received actual data
        if (!buffer || buffer.byteLength === 0) {
          throw new Error("File is empty or corrupted");
        }
        
        objectUrl = URL.createObjectURL(blob);

        if (!isMounted) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        const detectedMimeType = response.headers.get("content-type") || blob.type || mimeType || null;
        console.log("[FilePreview] Setting blobUrl, mimeType:", detectedMimeType);
        
        setBlobUrl(objectUrl);
        setFileBuffer(buffer);
        setResolvedMimeType(detectedMimeType);
      } catch (loadError) {
        // Ignore abort errors from React Strict Mode double-mount
        if (controller.signal.aborted || (loadError instanceof Error && loadError.name === 'AbortError')) {
          console.log("[FilePreview] Fetch aborted (React Strict Mode)");
          if (isMounted) setIsLoading(false);
          return;
        }
        console.error("[FilePreview] Load error:", loadError);
        if (!isMounted) return;
        setBlobUrl(null);
        setFileBuffer(null);
        setPptxSlidesHtml([]);
        setError(loadError instanceof Error ? loadError.message : "Unable to load preview");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadFile();

    return () => {
      isMounted = false;
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [mimeType, storagePath]);

  const category = useMemo(
    () => getFileCategory(resolvedMimeType || mimeType),
    [mimeType, resolvedMimeType],
  );

  // Debug logging
  useEffect(() => {
    console.log("[FilePreview] Render state:", {
      storagePath: storagePath?.slice(0, 50),
      category,
      isLoading,
      error,
      hasBlobUrl: !!blobUrl,
      hasViewUrl: !!viewUrl,
      mimeType,
      resolvedMimeType,
    });
  }, [storagePath, category, isLoading, error, blobUrl, viewUrl, mimeType, resolvedMimeType]);

  useEffect(() => {
    if (category !== "docx" || !fileBuffer || !docxContainerRef.current) {
      if (docxContainerRef.current) {
        docxContainerRef.current.innerHTML = "";
      }
      return;
    }

    let isCancelled = false;

    const renderDocxPreview = async () => {
      console.log("[FilePreview] Rendering DOCX, buffer size:", fileBuffer?.byteLength);
      try {
        setIsRenderingDocx(true);
        setError(null);

        if (!docxContainerRef.current) {
          console.log("[FilePreview] No DOCX container ref");
          return;
        }

        docxContainerRef.current.innerHTML = "";
        console.log("[FilePreview] Calling docx-preview renderAsync...");
        
        await renderAsync(fileBuffer, docxContainerRef.current, docxContainerRef.current, {
          className: "atlas-docx",
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          useBase64URL: true,
        });
        
        console.log("[FilePreview] DOCX rendered successfully");
      } catch (renderError) {
        console.error("[FilePreview] DOCX render error:", renderError);
        if (!isCancelled) {
          setError(
            renderError instanceof Error
              ? `DOCX render error: ${renderError.message}`
              : "Unable to render Word preview",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsRenderingDocx(false);
        }
      }
    };

    void renderDocxPreview();

    const docxContainer = docxContainerRef.current;

    return () => {
      isCancelled = true;
      if (docxContainer) {
        docxContainer.innerHTML = "";
      }
    };
  }, [category, fileBuffer]);

  useEffect(() => {
    if (category !== "pptx" || !fileBuffer) {
      setPptxSlidesHtml([]);
      return;
    }

    let isCancelled = false;

    const renderPptxPreview = async () => {
      try {
        setIsRenderingPptx(true);
        setError(null);
        const slidesHtml = await pptxToHtml(fileBuffer, {
          width: 1280,
          height: 720,
          scaleToFit: true,
          letterbox: true,
        });
        if (!isCancelled) {
          setPptxSlidesHtml(slidesHtml);
        }
      } catch (renderError) {
        if (!isCancelled) {
          setPptxSlidesHtml([]);
          setError(
            renderError instanceof Error
              ? renderError.message
              : "Unable to render PowerPoint preview",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsRenderingPptx(false);
        }
      }
    };

    void renderPptxPreview();

    return () => {
      isCancelled = true;
    };
  }, [category, fileBuffer]);

  // Fetch view and download URLs when storagePath is available
  useEffect(() => {
    if (!storagePath) {
      setViewUrl(null);
      setDownloadUrl(null);
      return;
    }

    let isMounted = true;

    const fetchUrls = async () => {
      try {
        // Get view URL from API (presigned URL that allows viewing)
        const viewResponse = await filesApi.getPdfViewUrlByPath(storagePath);
        if (isMounted) {
          console.log("[FilePreview] Got view URL from API:", viewResponse.url);

          // Some presigned providers omit inline rendering hints; force inline for iframe preview.
          let normalizedViewUrl = viewResponse.url;
          if (category === "pdf" && !/[?&]response-content-type=/i.test(normalizedViewUrl)) {
            const separator = normalizedViewUrl.includes("?") ? "&" : "?";
            normalizedViewUrl = `${normalizedViewUrl}${separator}response-content-type=${encodeURIComponent("application/pdf")}`;
          }
          if (category === "pdf" && !/[?&]response-content-disposition=/i.test(normalizedViewUrl)) {
            const separator = normalizedViewUrl.includes("?") ? "&" : "?";
            normalizedViewUrl = `${normalizedViewUrl}${separator}response-content-disposition=${encodeURIComponent("inline")}`;
          }

          setViewUrl(normalizedViewUrl);
        }
      } catch (err) {
        // Fallback: use same-origin proxy URL if API fails
        const fallbackUrl = `/api/files/proxy/${encodeStoragePath(storagePath)}`;
        console.log("[FilePreview] API failed, using fallback URL:", fallbackUrl, err);
        if (isMounted) {
          setViewUrl(fallbackUrl);
        }
      }

      // Set download URL to the same proxy endpoint (browser will handle download)
      if (isMounted) {
        setDownloadUrl(`/api/files/proxy/${encodeStoragePath(storagePath)}`);
      }
    };

    void fetchUrls();

    return () => {
      isMounted = false;
    };
  }, [storagePath, category]);

  if (!storagePath) {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground">
        <FileText className="h-10 w-10 opacity-50" />
        <p>File preview is unavailable for this item.</p>
      </div>
    );
  }

  if (isLoading || isRenderingDocx || isRenderingPptx) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-lg border bg-muted/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }


  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {viewUrl || downloadUrl ? (
          <>
            {viewUrl ? (
              <Button asChild variant="outline" size="sm">
                <a href={viewUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open
                </a>
              </Button>
            ) : null}
            {downloadUrl ? (
              <Button asChild variant="outline" size="sm">
                <a href={downloadUrl} download={title || "document"}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </a>
              </Button>
            ) : null}
          </>
        ) : null}
      </div>

      {error ? (
        <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-6 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          {(error.includes("404") || error.includes("500") || error.includes("empty")) && (
            <p className="text-xs text-muted-foreground max-w-xs">
              The file may not exist in storage. You can try using the Open or Download buttons above, or contact support if the problem persists.
            </p>
          )}
        </div>
      ) : null}

      {category === "pdf" ? (
        <div className="h-full min-h-[600px] rounded-lg border overflow-hidden bg-white">
          {blobUrl ? (
            <iframe
              src={blobUrl}
              className="w-full h-full min-h-[600px]"
              title={title || "PDF Preview"}
              style={{ border: "none" }}
            />
          ) : viewUrl ? (
            <iframe
              src={viewUrl}
              className="w-full h-full min-h-[600px]"
              title={title || "PDF Preview"}
              style={{ border: "none" }}
            />
          ) : (
            <div className="flex h-full min-h-[600px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
        </div>
      ) : null}

      {category === "image" && blobUrl ? (
        <div className="flex min-h-[480px] items-center justify-center overflow-hidden rounded-lg border bg-black/5 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={blobUrl}
            alt={title || "Uploaded file preview"}
            className="max-h-[70vh] max-w-full rounded-md object-contain"
          />
        </div>
      ) : null}

      {category === "docx" ? (
        <div className="min-h-[480px] overflow-auto rounded-lg border bg-white p-4 text-black">
          <div ref={docxContainerRef} />
        </div>
      ) : null}

      {category === "pptx" ? (
        <div className="flex min-h-[480px] flex-col gap-6 overflow-auto rounded-lg border bg-[#0b1020] p-4">
          {pptxSlidesHtml.map((slideHtml, index) => (
            <div key={index} className="rounded-xl bg-black/20 p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white/80">
                <Presentation className="h-4 w-4" />
                Slide {index + 1}
              </div>
              <div
                className="overflow-hidden rounded-lg bg-white shadow-sm"
                dangerouslySetInnerHTML={{ __html: slideHtml }}
              />
            </div>
          ))}
        </div>
      ) : null}

      {(category === "word-legacy" || category === "powerpoint-legacy" || category === "text" || category === "unknown") ? (
        <div className="flex min-h-[320px] flex-col gap-4 rounded-lg border bg-muted/10 p-5">
          <div className="flex items-center gap-3">
            {category === "powerpoint-legacy" ? (
              <Presentation className="h-8 w-8 text-primary" />
            ) : category === "word-legacy" ? (
              <FileImage className="h-8 w-8 text-primary" />
            ) : (
              <FileText className="h-8 w-8 text-primary" />
            )}
            <div>
              <p className="font-medium">{title || "Document preview"}</p>
              <p className="text-sm text-muted-foreground">
                {category === "word-legacy"
                  ? "Legacy .doc files can be opened or downloaded. Extracted text preview is shown below when available."
                  : category === "powerpoint-legacy"
                    ? "Legacy .ppt files can be opened or downloaded. Extracted text preview is shown below when available."
                    : "Preview is limited for this file type."}
              </p>
            </div>
          </div>

          {previewText ? (
            <div className="rounded-lg border bg-background p-4">
              <p className="mb-2 text-sm font-medium">Extracted text preview</p>
              <pre className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                {previewText}
              </pre>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-background/70 p-6 text-sm text-muted-foreground">
              No inline text preview is available for this file yet. You can still open or download it.
            </div>
          )}
        </div>
      ) : null}

      {/* Fallback: if no category matched, show a generic message */}
      {!["pdf", "image", "docx", "pptx", "word-legacy", "powerpoint-legacy", "text", "unknown"].includes(category) && (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground">
          <FileText className="h-10 w-10 opacity-50" />
          <p>Preview not available for this file type ({category}).</p>
          <p className="text-xs">Try using the Open or Download buttons above.</p>
        </div>
      )}
    </div>
  );
}
