"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, Search, Users, MoreVertical, ShieldAlert, ShieldCheck, UserX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAdminUsersQuery, useApproveTeacherRequestMutation, useTeacherRequestsQuery, useUpdateUserMutation } from "@/queries/admin.queries";

const roleColors: Record<string, string> = {
  STUDENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  TEACHER:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  ADMIN: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

export default function AdminUsersPage() {
  const { data, isLoading, isError } = useAdminUsersQuery();
  const teacherRequestsQuery = useTeacherRequestsQuery();
  const updateMutation = useUpdateUserMutation();
  const approveTeacherRequestMutation = useApproveTeacherRequestMutation();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const users = data?.items ?? [];
  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const normalizedRole = user.role.toUpperCase();
        const normalizedStatus = user.is_active ? "active" : "inactive";
        const fullName = user.full_name || "";

        const matchesSearch =
          fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRole =
          roleFilter === "all" || normalizedRole.toLowerCase() === roleFilter;
        const matchesStatus =
          statusFilter === "all" || normalizedStatus === statusFilter;

        return matchesSearch && matchesRole && matchesStatus;
      }),
    [users, searchQuery, roleFilter, statusFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const stats = {
    total: users.length,
    students: users.filter((user) => user.role === "STUDENT").length,
    teachers: users.filter((user) => user.role === "TEACHER").length,
    active: users.filter((user) => user.is_active).length,
  };
  const pendingTeacherRequests = teacherRequestsQuery.data?.items ?? [];

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        type="error"
        title="Users unavailable"
        description="We couldn't load the user management data."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Review and filter real user accounts across the platform.
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-500">{stats.students}</p>
            <p className="text-sm text-muted-foreground">Students</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-500">{stats.teachers}</p>
            <p className="text-sm text-muted-foreground">Teachers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{stats.active}</p>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Pending Teacher Requests</h2>
              <p className="text-sm text-muted-foreground">
                Review educator verification requests before granting teacher access.
              </p>
            </div>
            <StatusChip status={pendingTeacherRequests.length ? "warning" : "active"} />
          </div>

          {teacherRequestsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading teacher requests...
            </div>
          ) : pendingTeacherRequests.length ? (
            <div className="space-y-3">
              {pendingTeacherRequests.slice(0, 5).map((request) => (
                <div key={request.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">{request.full_name || "Unnamed educator"}</p>
                    <p className="text-sm text-muted-foreground">{request.email}</p>
                    <p className="text-sm text-muted-foreground">
                      {request.requested_department} - {request.requested_domain}
                    </p>
                  </div>
                  <Button
                    className="min-h-11"
                    disabled={approveTeacherRequestMutation.isPending}
                    onClick={() => approveTeacherRequestMutation.mutate({ requestId: request.id })}
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Approve Teacher
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              type="no-results"
              title="No pending teacher requests"
              description="New educator requests will appear here for approval."
            />
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setCurrentPage(1);
            }}
            className="pl-10"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(event) => {
            setRoleFilter(event.target.value);
            setCurrentPage(1);
          }}
          className="min-h-11 rounded-lg border bg-background px-4 py-2 text-sm"
        >
          <option value="all">All Roles</option>
          <option value="student">Students</option>
          <option value="teacher">Teachers</option>
          <option value="admin">Admins</option>
        </select>
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setCurrentPage(1);
          }}
          className="min-h-11 rounded-lg border bg-background px-4 py-2 text-sm"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          {paginatedUsers.length ? (
            <>
              <div className="space-y-3 p-4 md:hidden">
                {paginatedUsers.map((user) => (
                  <div key={user.id} className="rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground">
                        {(user.full_name || user.email)
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{user.full_name || "Unnamed user"}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Role</p>
                        <span
                          className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-medium ${roleColors[user.role] || roleColors.STUDENT}`}
                        >
                          {user.role}
                        </span>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <div className="mt-1">
                          <StatusChip status={user.is_active ? "active" : "inactive"} />
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Filiere</p>
                        <p className="mt-1">{user.filiere || "-"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Joined</p>
                        <p className="mt-1">{new Date(user.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium">User</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Role</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Filiere</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Joined</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((user) => (
                    <tr key={user.id} className="border-b">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground">
                            {(user.full_name || user.email)
                              .split(" ")
                              .map((part) => part[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{user.full_name || "Unnamed user"}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${roleColors[user.role] || roleColors.STUDENT}`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {user.filiere || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip status={user.is_active ? "active" : "inactive"} />
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={updateMutation.isPending}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => updateMutation.mutate({ userId: user.id, data: { is_active: !user.is_active }})}>
                              {user.is_active ? <><UserX className="mr-2 h-4 w-4 text-destructive" /> Deactivate (Ban)</> : <><ShieldCheck className="mr-2 h-4 w-4 text-emerald-500" /> Reactivate</>}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem disabled={user.role === 'ADMIN'} onClick={() => updateMutation.mutate({ userId: user.id, data: { role: 'ADMIN' }})}>
                              <ShieldAlert className="mr-2 h-4 w-4 text-amber-500" /> Make Admin
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={user.role === 'TEACHER'} onClick={() => updateMutation.mutate({ userId: user.id, data: { role: 'TEACHER' }})}>
                              <Users className="mr-2 h-4 w-4 text-purple-500" /> Make Teacher
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={user.role === 'STUDENT'} onClick={() => updateMutation.mutate({ userId: user.id, data: { role: 'STUDENT' }})}>
                              <Users className="mr-2 h-4 w-4 text-blue-500" /> Make Student
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          ) : (
            <EmptyState
              type="no-results"
              title="No users found"
              description="Try adjusting the search or filters."
            />
          )}
        </CardContent>
      </Card>

      {filteredUsers.length > itemsPerPage ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of{" "}
            {filteredUsers.length} users
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="min-h-11" disabled>
              {currentPage}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
