"use client";

import { useMemo, useState } from "react";
import { Building2, ChevronLeft, ChevronRight, Download, Loader2, Search, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useSuperadminEstablishmentsQuery } from "@/queries/admin.queries";

type EstablishmentRow = {
  id: string;
  name: string;
  domain: string;
  created_at: string;
  users?: number;
  students?: number;
  teachers?: number;
  admins?: number;
};

export default function SuperadminEstablishmentsPage() {
  const { data, isLoading, isError } = useSuperadminEstablishmentsQuery();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const establishments = useMemo(
    () => (data ?? []) as EstablishmentRow[],
    [data],
  );
  const filteredEstablishments = useMemo(
    () =>
      establishments.filter((establishment) => {
        const query = searchQuery.toLowerCase();
        return (
          establishment.name.toLowerCase().includes(query) ||
          establishment.domain.toLowerCase().includes(query)
        );
      }),
    [establishments, searchQuery],
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredEstablishments.length / itemsPerPage),
  );
  const paginatedEstablishments = filteredEstablishments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const stats = {
    total: establishments.length,
    totalUsers: establishments.reduce((sum, item) => sum + (item.users || 0), 0),
    totalStudents: establishments.reduce(
      (sum, item) => sum + (item.students || 0),
      0,
    ),
    totalTeachers: establishments.reduce(
      (sum, item) => sum + (item.teachers || 0),
      0,
    ),
  };

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
        title="Establishments unavailable"
        description="We couldn't load the establishment directory."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Establishment Management</h1>
          <p className="text-muted-foreground">
            Review real establishment records and user totals.
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
            <p className="text-sm text-muted-foreground">Establishments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-500">
              {stats.totalUsers.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Total Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-500">
              {stats.totalStudents.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Students</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-500">
              {stats.totalTeachers.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Teachers</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search establishments..."
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setCurrentPage(1);
          }}
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {paginatedEstablishments.length ? (
            <>
              <div className="space-y-3 p-4 md:hidden">
                {paginatedEstablishments.map((establishment) => (
                  <div key={establishment.id} className="rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{establishment.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {establishment.domain}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Users</p>
                        <p className="mt-1">{(establishment.users || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Students</p>
                        <p className="mt-1">{(establishment.students || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Teachers</p>
                        <p className="mt-1">{(establishment.teachers || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Created</p>
                        <p className="mt-1">{new Date(establishment.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Establishment
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Domain</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Users</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Students</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Teachers</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEstablishments.map((establishment) => (
                    <tr key={establishment.id} className="border-b">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <p className="font-medium">{establishment.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {establishment.domain}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="inline-flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {(establishment.users || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {(establishment.students || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {(establishment.teachers || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(establishment.created_at).toLocaleDateString()}
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
              title="No establishments found"
              description="Try adjusting the search term."
            />
          )}
        </CardContent>
      </Card>

      {filteredEstablishments.length > itemsPerPage ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, filteredEstablishments.length)} of{" "}
            {filteredEstablishments.length} establishments
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
