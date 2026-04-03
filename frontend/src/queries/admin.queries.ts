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
