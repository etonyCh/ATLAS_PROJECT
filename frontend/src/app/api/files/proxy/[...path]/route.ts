import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.atlas.tn/api/v1";

export const dynamic = "force-dynamic";

function buildBackendUrl(pathSegments: string[]) {
  const normalizedPath = pathSegments
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${API_BASE_URL.replace(/\/$/, "")}/files/proxy/${normalizedPath}`;
}

async function forwardFileRequest(
  request: NextRequest,
  pathSegments: string[],
) {
  const authorization = request.headers.get("authorization");

  const upstreamResponse = await fetch(buildBackendUrl(pathSegments), {
    method: "GET",
    headers: authorization ? { Authorization: authorization } : {},
    cache: "no-store",
  });

  const responseHeaders = new Headers();
  const passthroughHeaders = [
    "content-type",
    "content-disposition",
    "content-length",
    "cache-control",
    "etag",
    "last-modified",
  ];

  for (const headerName of passthroughHeaders) {
    const value = upstreamResponse.headers.get(headerName);
    if (value) {
      responseHeaders.set(headerName, value);
    }
  }

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> | { path: string[] } },
) {
  const { path } = await Promise.resolve(context.params);
  return forwardFileRequest(request, path);
}
