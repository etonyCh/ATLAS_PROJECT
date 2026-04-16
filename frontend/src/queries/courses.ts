import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { coursesApi } from "@/lib/api";

export function useCoursesQuery(params?: {
  filiere?: string;
  niveau?: string;
  type?: string;
}) {
  return useQuery({
    queryKey: ["courses", params],
    queryFn: () => coursesApi.list(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCourseQuery(courseId: string) {
  return useQuery({
    queryKey: ["course", courseId],
    queryFn: () => coursesApi.getById(courseId),
    enabled: Boolean(courseId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCourseVersionsQuery(courseId: string) {
  return useQuery({
    queryKey: ["course", courseId, "versions"],
    queryFn: () => coursesApi.getVersions(courseId),
    enabled: Boolean(courseId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useVersionQuery(versionId: string | null) {
  return useQuery({
    queryKey: ["version", versionId],
    queryFn: () => coursesApi.getVersion(versionId!),
    enabled: Boolean(versionId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCourseStatsQuery(courseId: string) {
  return useQuery({
    queryKey: ["course", courseId, "stats"],
    queryFn: () => coursesApi.getStats(courseId),
    enabled: Boolean(courseId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTeacherCourses() {
  return useQuery({
    queryKey: ["courses", "my-uploads"],
    queryFn: () => coursesApi.getMyUploads(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCourseCatalogQuery() {
  return useQuery({
    queryKey: ["courses", "catalog"],
    queryFn: () => coursesApi.getCatalog(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDeleteCourseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => coursesApi.delete(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses", "my-uploads"] });
    },
  });
}

export function useUpdateCourseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, data }: { courseId: string; data: any }) =>
      coursesApi.update(courseId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["courses", "my-uploads"] });
      queryClient.invalidateQueries({ queryKey: ["course", variables.courseId] });
    },
  });
}
