"use client";

import { useMemo, useState } from "react";
import { BookOpen, Building2, Loader2, Plus, Save, Shield, ShieldCheck, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import {
  useAdminCatalogCoursesQuery,
  useAdminDepartmentsQuery,
  useAdminEstablishmentsQuery,
  useCreateCatalogCourseMutation,
  useCreateDepartmentMutation,
  useCreateEstablishmentMutation,
  useUpdateCatalogCourseMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
  useDeleteCatalogCourseMutation,
} from "@/queries/admin.queries";
import { useTranslation } from "@/hooks/use-translation";

const LEVEL_OPTIONS = ["L1", "L2", "L3", "M1", "M2", "Doctorat"];
const COURSE_TYPES = ["LECTURE", "TD", "TP", "EXAM", "SUMMARY", "OTHER"];
const LANGUAGE_OPTIONS = ["FR", "EN", "AR"];

type CourseFormState = {
  title: string;
  description: string;
  department_id: string;
  level: string;
  course_type: string;
  language: string;
};

const EMPTY_COURSE_FORM: CourseFormState = {
  title: "",
  description: "",
  department_id: "",
  level: "L1",
  course_type: "LECTURE",
  language: "FR",
};

export default function AdminSetupPage() {
  const { t, tSection } = useTranslation();
  const adminT = tSection("admin");
  const departmentsQuery = useAdminDepartmentsQuery();
  const coursesQuery = useAdminCatalogCoursesQuery();
  const createDepartmentMutation = useCreateDepartmentMutation();
  const updateDepartmentMutation = useUpdateDepartmentMutation();
  const deleteDepartmentMutation = useDeleteDepartmentMutation();
  const createCourseMutation = useCreateCatalogCourseMutation();
  const updateCourseMutation = useUpdateCatalogCourseMutation();
  const deleteCourseMutation = useDeleteCatalogCourseMutation();

  const departments = departmentsQuery.data ?? [];
  const courses = coursesQuery.data ?? [];

  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newDepartmentLevels, setNewDepartmentLevels] = useState<string[]>(["L1"]);
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
  const [editingDepartmentName, setEditingDepartmentName] = useState("");
  const [courseForm, setCourseForm] = useState<CourseFormState>(EMPTY_COURSE_FORM);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingCourseForm, setEditingCourseForm] = useState<CourseFormState>(EMPTY_COURSE_FORM);

  const selectedDepartment = useMemo(
    () => departments.find((department) => department.id === courseForm.department_id),
    [courseForm.department_id, departments],
  );

  const editingCourseDepartment = useMemo(
    () => departments.find((department) => department.id === editingCourseForm.department_id),
    [departments, editingCourseForm.department_id],
  );

  const toggleLevel = (level: string, selectedLevels: string[], setter: (levels: string[]) => void) => {
    setter(
      selectedLevels.includes(level)
        ? selectedLevels.filter((item) => item !== level)
        : [...selectedLevels, level],
    );
  };

  const handleCreateDepartment = async () => {
    if (!newDepartmentName.trim()) return;
    await createDepartmentMutation.mutateAsync({
      name: newDepartmentName.trim(),
      allowed_levels: newDepartmentLevels,
    });
    setNewDepartmentName("");
    setNewDepartmentLevels(["L1"]);
  };

  const handleCreateCourse = async () => {
    if (!courseForm.title.trim() || !courseForm.department_id) return;
    await createCourseMutation.mutateAsync({
      ...courseForm,
      title: courseForm.title.trim(),
      description: courseForm.description.trim() || null,
    });
    setCourseForm(EMPTY_COURSE_FORM);
  };

  const startEditingDepartment = (departmentId: string, name: string) => {
    setEditingDepartmentId(departmentId);
    setEditingDepartmentName(name);
  };

  const saveDepartmentName = async () => {
    if (!editingDepartmentId || !editingDepartmentName.trim()) return;
    await updateDepartmentMutation.mutateAsync({
      departmentId: editingDepartmentId,
      data: { name: editingDepartmentName.trim() },
    });
    setEditingDepartmentId(null);
    setEditingDepartmentName("");
  };

  const startEditingCourse = (courseId: string) => {
    const course = courses.find((item) => item.id === courseId);
    if (!course) return;
    setEditingCourseId(courseId);
    setEditingCourseForm({
      title: course.title,
      description: course.description ?? "",
      department_id: course.department_id ?? "",
      level: course.level ?? "L1",
      course_type: course.course_type ?? "LECTURE",
      language: course.language ?? "FR",
    });
  };

  const saveCourse = async () => {
    if (!editingCourseId || !editingCourseForm.title.trim() || !editingCourseForm.department_id) return;
    await updateCourseMutation.mutateAsync({
      courseId: editingCourseId,
      data: {
        ...editingCourseForm,
        title: editingCourseForm.title.trim(),
        description: editingCourseForm.description.trim() || null,
      },
    });
    setEditingCourseId(null);
    setEditingCourseForm(EMPTY_COURSE_FORM);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{adminT.academicSetup}</h1>
        <p className="text-muted-foreground">
          {adminT.academicSetupDescription}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{adminT.departmentsAndLevels}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3 rounded-lg border p-4">
              <Input
                label={adminT.newDepartment}
                value={newDepartmentName}
                onChange={(event) => setNewDepartmentName(event.target.value)}
                placeholder={adminT.departmentPlaceholder}
              />
              <div className="flex flex-wrap gap-2">
                {LEVEL_OPTIONS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => toggleLevel(level, newDepartmentLevels, setNewDepartmentLevels)}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      newDepartmentLevels.includes(level) ? "bg-primary text-primary-foreground" : "bg-background"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <Button onClick={handleCreateDepartment} disabled={createDepartmentMutation.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                {adminT.addDepartment}
              </Button>
            </div>

            <div className="space-y-4">
              {departmentsQuery.isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                departments.map((department) => {
                  const selectedLevels = department.allowed_levels ?? [];
                  return (
                    <div key={department.id} className="rounded-lg border p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        {editingDepartmentId === department.id ? (
                          <div className="flex flex-1 items-center gap-2">
                            <Input
                              value={editingDepartmentName}
                              onChange={(event) => setEditingDepartmentName(event.target.value)}
                              placeholder={adminT.departmentPlaceholder}
                            />
                            <Button size="sm" onClick={saveDepartmentName} disabled={updateDepartmentMutation.isPending}>
                              <Save className="mr-2 h-4 w-4" />
                              {t("ui.save")}
                            </Button>
                          </div>
                        ) : (
                          <>
                            <p className="font-medium">{department.name}</p>
                            <Button variant="ghost" size="sm" onClick={() => startEditingDepartment(department.id, department.name)}>
                              {adminT.rename}
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => { if(window.confirm(adminT.confirmDeleteDepartment)) deleteDepartmentMutation.mutate(department.id) }} disabled={deleteDepartmentMutation.isPending}>
                              {t("ui.delete")}
                            </Button>
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {LEVEL_OPTIONS.map((level) => (
                          <button
                            key={level}
                            type="button"
                            onClick={() =>
                              updateDepartmentMutation.mutate({
                                departmentId: department.id,
                                data: {
                                  allowed_levels: selectedLevels.includes(level)
                                    ? selectedLevels.filter((item) => item !== level)
                                    : [...selectedLevels, level],
                                },
                              })
                            }
                            className={`rounded-full border px-3 py-1 text-sm ${
                              selectedLevels.includes(level) ? "bg-primary text-primary-foreground" : "bg-background"
                            }`}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{adminT.catalogCourses}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3 rounded-lg border p-4">
              <Input
                label={adminT.courseTitle}
                value={courseForm.title}
                onChange={(event) => setCourseForm((current) => ({ ...current, title: event.target.value }))}
              />
              <Input
                label={adminT.courseDescription}
                value={courseForm.description}
                onChange={(event) => setCourseForm((current) => ({ ...current, description: event.target.value }))}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("leaderboard.department")}</label>
                  <Select
                    value={courseForm.department_id}
                    onChange={(event) =>
                      setCourseForm((current) => ({
                        ...current,
                        department_id: event.target.value,
                        level: "L1",
                      }))
                    }
                  >
                    <option value="">{adminT.selectDepartment}</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("leaderboard.level")}</label>
                  <Select
                    value={courseForm.level}
                    onChange={(event) => setCourseForm((current) => ({ ...current, level: event.target.value }))}
                  >
                    {(selectedDepartment?.allowed_levels ?? LEVEL_OPTIONS).map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <Button onClick={handleCreateCourse} disabled={createCourseMutation.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                {adminT.createCatalogCourse}
              </Button>
            </div>

            <div className="space-y-4">
              {coursesQuery.isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                courses.map((course) => (
                  <div key={course.id} className="rounded-lg border p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 rounded-full bg-primary/10 p-2 text-primary">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <div className="flex-1 space-y-4">
                        {editingCourseId === course.id ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <Input
                              label={adminT.courseTitle}
                              value={editingCourseForm.title}
                              onChange={(event) =>
                                setEditingCourseForm((current) => ({ ...current, title: event.target.value }))
                              }
                            />
                            <Input
                              label={adminT.courseDescription}
                              value={editingCourseForm.description}
                              onChange={(event) =>
                                setEditingCourseForm((current) => ({ ...current, description: event.target.value }))
                              }
                            />
                            <div className="space-y-2">
                              <label className="text-sm font-medium">{t("leaderboard.department")}</label>
                              <Select
                                value={editingCourseForm.department_id}
                                onChange={(event) =>
                                  setEditingCourseForm((current) => ({
                                    ...current,
                                    department_id: event.target.value,
                                    level: "L1",
                                  }))
                                }
                              >
                                <option value="">{adminT.selectDepartment}</option>
                                {departments.map((department) => (
                                  <option key={department.id} value={department.id}>
                                    {department.name}
                                  </option>
                                ))}
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">{t("leaderboard.level")}</label>
                              <Select
                                value={editingCourseForm.level}
                                onChange={(event) => setEditingCourseForm((current) => ({ ...current, level: event.target.value }))}
                              >
                                {(editingCourseDepartment?.allowed_levels ?? LEVEL_OPTIONS).map((level) => (
                                  <option key={level} value={level}>
                                    {level}
                                  </option>
                                ))}
                              </Select>
                            </div>
                            <div className="flex items-end gap-2">
                              <Button onClick={saveCourse} disabled={updateCourseMutation.isPending}>
                                <Save className="mr-2 h-4 w-4" />
                                {t("ui.save")}
                              </Button>
                              <Button variant="ghost" onClick={() => setEditingCourseId(null)}>
                                {t("ui.cancel")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">{course.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {course.department_name ?? "Department"} | {course.level}
                              </p>
                              {course.description ? (
                                <p className="mt-1 text-sm text-muted-foreground">{course.description}</p>
                              ) : null}
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => startEditingCourse(course.id)}>
                                {t("ui.edit")}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateCourseMutation.mutate({
                                    courseId: course.id,
                                    data: { is_deleted: !course.is_deleted },
                                  })
                                }
                              >
                                {course.is_deleted ? adminT.restore : adminT.archive}
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => { if(window.confirm(adminT.confirmDeleteCourse)) deleteCourseMutation.mutate(course.id) }}
                                disabled={deleteCourseMutation.isPending}
                              >
                                {t("ui.delete")}
                              </Button>
                            </div>
                          </div>
                        )}
                        {course.is_deleted ? (
                          <p className="text-sm font-medium text-amber-700">{adminT.archivedNotice}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
