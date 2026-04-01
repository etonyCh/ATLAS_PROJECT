"use client";

import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { AIToolsTabPanel } from "@/components/ai/ai-tools-tab-panel";
import { useCourseQuery } from "@/queries";

export default function MindmapPage() {
  const params = useParams();
  const courseId = params.id as string;
  const { data: course, isLoading, isError } = useCourseQuery(courseId);

  if (isLoading) {
    return <Skeleton className="h-[calc(100vh-220px)] w-full" />;
  }

  if (isError || !course) {
    return (
      <EmptyState
        type="error"
        title="Course unavailable"
        description="We couldn't load this course to generate a mind map."
      />
    );
  }

  return (
    <div className="h-[calc(100vh-220px)] overflow-hidden rounded-xl border">
      <AIToolsTabPanel tool="mindmap" course={course} className="h-full" />
    </div>
  );
}
