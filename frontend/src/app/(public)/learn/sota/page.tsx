import fs from "fs";
import path from "path";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, BookOpen, FileText } from "lucide-react";
import { MDXRemote } from "next-mdx-remote/rsc";

const SOTA_PATH = path.join(process.cwd(), "..", "..", "doc", "sota.md");

export const metadata: Metadata = {
  title: "State of the Art — ATLAS Learn",
  description:
    "Current state-of-the-art in software engineering education and practice.",
};

export default function SotaPage() {
  let content = "";
  if (fs.existsSync(SOTA_PATH)) {
    content = fs.readFileSync(SOTA_PATH, "utf-8");
  }

  return (
    <main className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            href="/learn"
            className="flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Lessons
          </Link>
          <Link href="/" className="flex items-center gap-2 text-slate-900">
            <BookOpen className="h-5 w-5 text-blue-700" />
            <span className="text-sm font-semibold">ATLAS</span>
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-8 flex items-center gap-3">
          <FileText className="h-8 w-8 text-blue-700" />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              State of the Art
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Research foundation for the ATLAS curriculum — 2026
            </p>
          </div>
        </div>

        <div className="prose prose-slate max-w-none prose-headings:font-semibold prose-headings:text-slate-900 prose-a:text-blue-700 prose-code:text-blue-800 prose-code:bg-blue-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-strong:text-slate-900">
          <MDXRemote source={content} />
        </div>
      </article>
    </main>
  );
}
