import Link from "next/link";
import type { Metadata } from "next";
import {
  BookOpen,
  Shield,
  Cloud,
  Activity,
  Database,
  Server,
  Zap,
  Layers,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Learn — ATLAS",
  description:
    "Master modern software engineering with our 8-pillar curriculum.",
};

const pillars = [
  {
    number: "01",
    title: "System Design",
    subtitle: "The Blueprint",
    description:
      "Architecture, microservices, scalability, and distributed systems.",
    icon: Layers,
    slug: "system-design",
    color: "from-blue-600 to-blue-800",
  },
  {
    number: "02",
    title: "APIs",
    subtitle: "The Language",
    description: "REST, GraphQL, gRPC, and API design best practices.",
    icon: Server,
    slug: "apis",
    color: "from-emerald-600 to-emerald-800",
  },
  {
    number: "03",
    title: "Database Systems",
    subtitle: "The Memory",
    description: "SQL, NoSQL, vector databases, and data modeling.",
    icon: Database,
    slug: "databases",
    color: "from-violet-600 to-violet-800",
  },
  {
    number: "04",
    title: "Security",
    subtitle: "The Shield",
    description:
      "OWASP, authentication, encryption, and zero-trust architecture.",
    icon: Shield,
    slug: "security",
    color: "from-red-600 to-red-800",
  },
  {
    number: "05",
    title: "DevOps",
    subtitle: "The Factory",
    description: "CI/CD, containers, infrastructure-as-code, and deployment.",
    icon: Zap,
    slug: "devops",
    color: "from-amber-600 to-amber-800",
  },
  {
    number: "06",
    title: "Performance",
    subtitle: "The Tuning",
    description: "Load balancing, caching, optimization, and monitoring.",
    icon: Activity,
    slug: "performance",
    color: "from-cyan-600 to-cyan-800",
  },
  {
    number: "07",
    title: "Cloud Services",
    subtitle: "The Foundation",
    description: "AWS, GCP, Azure, and cloud-native architecture patterns.",
    icon: Cloud,
    slug: "cloud",
    color: "from-sky-600 to-sky-800",
  },
  {
    number: "08",
    title: "Monitoring",
    subtitle: "The Pulse",
    description: "Observability, alerting, SLOs, and incident response.",
    icon: Activity,
    slug: "monitoring",
    color: "from-rose-600 to-rose-800",
  },
];

export default function LearnPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <section className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2 text-slate-900">
            <BookOpen className="h-6 w-6 text-blue-700" />
            <span className="text-lg font-semibold tracking-tight">
              ATLAS Learn
            </span>
          </Link>
          <Link
            href="/"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Back to ATLAS
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800">
            8-Pillar Curriculum
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950">
            Master Modern Software Engineering
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-600">
            A comprehensive curriculum covering the essential pillars of backend
            and platform engineering, from system design to monitoring.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map(
            ({
              number,
              title,
              subtitle,
              description,
              icon: Icon,
              slug,
              color,
            }) => (
              <Link
                key={slug}
                href={`/learn/${slug}`}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-slate-300"
              >
                <div
                  className={`absolute top-0 right-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full bg-gradient-to-br ${color} opacity-10 transition group-hover:opacity-20`}
                />
                <div className="relative">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-xs font-mono font-medium text-slate-400">
                      {number}
                    </span>
                    <Icon className="h-6 w-6 text-slate-500 transition group-hover:text-blue-700" />
                  </div>
                  <h2 className="text-xl font-semibold text-slate-950">
                    {title}
                  </h2>
                  <p className="mt-1 text-sm font-medium text-blue-700">
                    {subtitle}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {description}
                  </p>
                </div>
              </Link>
            ),
          )}
        </div>

        <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-8">
          <h2 className="text-xl font-semibold text-slate-950">
            State of the Art
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Explore the current state-of-the-art in software engineering
            practice and research.
          </p>
          <Link
            href="/learn/sota"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Read SOTA Report
          </Link>
        </div>
      </section>
    </main>
  );
}
