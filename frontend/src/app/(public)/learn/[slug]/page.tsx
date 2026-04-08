import fs from "fs";
import path from "path";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, BookOpen, ChevronRight } from "lucide-react";
import { MDXRemote } from "next-mdx-remote/rsc";

const DOC_DIR = path.join(process.cwd(), "..", "..", "doc", "curriculum");

const slugToFileMap: Record<string, string> = {
  "system-design": "01-system-design.md",
  apis: "02-apis.md",
  databases: "03-databases.md",
  security: "04-security.md",
  devops: "05-devops.md",
  performance: "06-performance.md",
  cloud: "07-cloud.md",
  monitoring: "08-monitoring.md",
};

const pillarNav = [
  { slug: "system-design", label: "System Design" },
  { slug: "apis", label: "APIs" },
  { slug: "databases", label: "Databases" },
  { slug: "security", label: "Security" },
  { slug: "devops", label: "DevOps" },
  { slug: "performance", label: "Performance" },
  { slug: "cloud", label: "Cloud" },
  { slug: "monitoring", label: "Monitoring" },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const fileName = slugToFileMap[slug];
  if (!fileName) return { title: "Not Found" };

  const filePath = path.join(DOC_DIR, fileName);
  if (!fs.existsSync(filePath)) return { title: "Not Found" };

  const content = fs.readFileSync(filePath, "utf-8");
  const title = content.split("\n")[0]?.replace(/^# /, "") || slug;

  return {
    title: `${title} — ATLAS Learn`,
    description: `Learn about ${title.toLowerCase()} as part of the ATLAS 8-pillar curriculum.`,
  };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const fileName = slugToFileMap[slug];

  if (!fileName) notFound();

  const filePath = path.join(DOC_DIR, fileName);
  if (!fs.existsSync(filePath)) notFound();

  const content = fs.readFileSync(filePath, "utf-8");
  const currentIndex = pillarNav.findIndex((p) => p.slug === slug);
  const prevPillar = currentIndex > 0 ? pillarNav[currentIndex - 1] : null;
  const nextPillar =
    currentIndex < pillarNav.length - 1 ? pillarNav[currentIndex + 1] : null;

  return (
    <main className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            href="/learn"
            className="flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            All Lessons
          </Link>
          <Link href="/" className="flex items-center gap-2 text-slate-900">
            <BookOpen className="h-5 w-5 text-blue-700" />
            <span className="text-sm font-semibold">ATLAS</span>
          </Link>
        </div>
      </header>

      <nav className="border-b bg-slate-50">
        <div className="mx-auto max-w-5xl px-6 py-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            {pillarNav.map((pillar, i) => (
              <div key={pillar.slug} className="flex items-center">
                {i > 0 && (
                  <ChevronRight className="mx-1 h-3 w-3 text-slate-400" />
                )}
                <Link
                  href={`/learn/${pillar.slug}`}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    pillar.slug === slug
                      ? "bg-blue-700 text-white"
                      : "text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}. {pillar.label}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </nav>

      <article className="mx-auto max-w-3xl px-6 py-12">
        <div className="prose prose-slate max-w-none prose-headings:font-semibold prose-headings:text-slate-900 prose-a:text-blue-700 prose-code:text-blue-800 prose-code:bg-blue-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-strong:text-slate-900 prose-table:border-collapse prose-th:border prose-th:border-slate-300 prose-th:bg-slate-50 prose-th:px-4 prose-th:py-2 prose-td:border prose-td:border-slate-300 prose-td:px-4 prose-td:py-2">
          <MDXRemote source={content} />
        </div>

        <div className="mt-16 flex items-center justify-between border-t pt-8">
          {prevPillar ? (
            <Link
              href={`/learn/${prevPillar.slug}`}
              className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              ← {prevPillar.label}
            </Link>
          ) : (
            <div />
          )}
          {nextPillar ? (
            <Link
              href={`/learn/${nextPillar.slug}`}
              className="rounded-lg bg-blue-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-800"
            >
              {nextPillar.label} →
            </Link>
          ) : (
            <Link
              href="/learn/sota"
              className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Read SOTA Report →
            </Link>
          )}
        </div>
      </article>
    </main>
  );
}
