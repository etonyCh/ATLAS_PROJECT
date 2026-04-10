import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, superadminApi } from "@/lib/api";

export function useAdminUsersQuery() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => adminApi.listUsers(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTeacherRequestsQuery() {
  return useQuery({
    queryKey: ["admin", "teacher-requests"],
    queryFn: () => adminApi.listTeacherRequests(),
    staleTime: 60 * 1000,
  });
}

export function useAdminDepartmentsQuery() {
  return useQuery({
    queryKey: ["admin", "departments"],
    queryFn: () => adminApi.listDepartments(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminCatalogCoursesQuery() {
  return useQuery({
    queryKey: ["admin", "catalog", "courses"],
    queryFn: () => adminApi.listCatalogCourses(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSuperadminEstablishmentsQuery() {
  return useQuery({
    queryKey: ["superadmin", "establishments"],
    queryFn: () => superadminApi.getEstablishments(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: Parameters<typeof adminApi.updateUser>[1] }) =>
      adminApi.updateUser(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "admin"] }); // Invalidate dashboard stats
    },
  });
}

export function useApproveTeacherRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, data }: { requestId: string; data?: { review_note?: string } }) =>
      adminApi.approveTeacherRequest(requestId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "teacher-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "admin"] });
    },
  });
}

export function useImportTeachersMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: FormData) => adminApi.importTeachers(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "teacher-requests"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "admin"] });
    },
  });
}

export function useCreateDepartmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; allowed_levels: string[] }) =>
      adminApi.createDepartment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "departments"] });
    },
  });
}

export function useUpdateDepartmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      departmentId,
      data,
    }: {
      departmentId: string;
      data: { name?: string; allowed_levels?: string[] };
    }) => adminApi.updateDepartment(departmentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "departments"] });
    },
  });
}

export function useCreateCatalogCourseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string | null;
      department_id: string;
      level: string;
      course_type: string;
      academic_year: string;
      language: string;
    }) => adminApi.createCatalogCourse(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "catalog", "courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
  });
}

export function useUpdateCatalogCourseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      courseId,
      data,
    }: {
      courseId: string;
      data: {
        title?: string;
        description?: string | null;
        department_id?: string;
        level?: string;
        course_type?: string;
        academic_year?: string;
        language?: string;
        is_deleted?: boolean;
      };
    }) => adminApi.updateCatalogCourse(courseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "catalog", "courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
  });
}
