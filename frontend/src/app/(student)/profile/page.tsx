"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, Save, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import type { Gender, StudentLevel } from "@/types/api.types";

type ProfileFormState = {
  full_name: string;
  filiere: string;
  level: string;
  student_id: string;
  program: string;
  academic_year: string;
  date_of_birth: string;
  gender: string;
  phone_number: string;
  address: string;
  preferred_language: string;
  profile_picture_url: string;
};

function buildFormState(user: ReturnType<typeof useAuthStore.getState>["user"]): ProfileFormState {
  return {
    full_name: user?.full_name ?? "",
    filiere: user?.filiere ?? "",
    level: user?.level ?? user?.niveau ?? "",
    student_id: user?.student_id ?? "",
    program: user?.program ?? "",
    academic_year: user?.academic_year ?? "",
    date_of_birth: user?.date_of_birth ?? "",
    gender: user?.gender ?? "",
    phone_number: user?.phone_number ?? "",
    address: user?.address ?? "",
    preferred_language: user?.preferred_language ?? "",
    profile_picture_url: user?.profile_picture_url ?? "",
  };
}

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<ProfileFormState>(buildFormState(user));

  const registrationOptionsQuery = useQuery({
    queryKey: ["auth", "registration-options"],
    queryFn: () => authApi.getRegistrationOptions(),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    setForm(buildFormState(user));
  }, [user]);

  const departments = registrationOptionsQuery.data?.departments ?? [];
  const selectedDepartment = departments.find((department) => department.name === form.filiere);
  const availableLevels = useMemo(
    () => ((selectedDepartment?.levels ?? registrationOptionsQuery.data?.levels ?? []) as StudentLevel[]),
    [registrationOptionsQuery.data?.levels, selectedDepartment?.levels],
  );

  const updateField = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleProfilePictureChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Profile picture must be 2MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateField("profile_picture_url", typeof reader.result === "string" ? reader.result : "");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const updatedUser = await authApi.updateProfile({
        full_name: form.full_name || null,
        filiere: form.filiere || null,
        level: (form.level || null) as StudentLevel | null,
        student_id: form.student_id || null,
        program: form.program || null,
        academic_year: form.academic_year || null,
        date_of_birth: form.date_of_birth || null,
        gender: (form.gender || null) as Gender | null,
        phone_number: form.phone_number || null,
        address: form.address || null,
        preferred_language: form.preferred_language || null,
        profile_picture_url: form.profile_picture_url || null,
      });
      setUser(updatedUser);
      setIsEditing(false);
      setSuccess("Profile updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Manage your academic and personal information.</p>
      </div>

      {error ? <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
      {success ? <div className="rounded-lg bg-emerald-100 p-3 text-sm text-emerald-700">{success}</div> : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Student Profile</CardTitle>
          <Button onClick={() => (isEditing ? handleSave() : setIsEditing(true))} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isEditing ? (isSaving ? "Saving..." : "Save") : "Edit"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              {form.profile_picture_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.profile_picture_url} alt="Profile" className="h-20 w-20 rounded-full object-cover" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-10 w-10 text-primary" />
                </div>
              )}
              {isEditing ? (
                <label className="absolute bottom-0 right-0 cursor-pointer rounded-full bg-primary p-1.5 text-primary-foreground">
                  <Camera className="h-3 w-3" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleProfilePictureChange} />
                </label>
              ) : null}
            </div>
            <div>
              <p className="font-semibold">{user?.full_name || "Student"}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Academic Information</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Full Name" value={form.full_name} onChange={(event) => updateField("full_name", event.target.value)} disabled={!isEditing} />
              <Input label="Email" value={user?.email || ""} disabled />
              <div className="space-y-2">
                <label className="text-sm font-medium">Department</label>
                <Select
                  value={form.filiere}
                  onChange={(event) => {
                    updateField("filiere", event.target.value);
                    updateField("level", "");
                  }}
                  disabled={!isEditing}
                >
                  <option value="">Select department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.name}>
                      {department.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Level</label>
                <Select value={form.level} onChange={(event) => updateField("level", event.target.value)} disabled={!isEditing || !form.filiere}>
                  <option value="">Select level</option>
                  {availableLevels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </Select>
              </div>
              <Input label="Student ID / Roll Number" value={form.student_id} onChange={(event) => updateField("student_id", event.target.value)} disabled={!isEditing} />
              <Input label="Program / Course of Study" value={form.program} onChange={(event) => updateField("program", event.target.value)} disabled={!isEditing} />
              <Input label="Year" value={form.academic_year} onChange={(event) => updateField("academic_year", event.target.value)} disabled={!isEditing} />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Personal Information</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Date of Birth" type="date" value={form.date_of_birth} onChange={(event) => updateField("date_of_birth", event.target.value)} disabled={!isEditing} />
              <div className="space-y-2">
                <label className="text-sm font-medium">Gender</label>
                <Select value={form.gender} onChange={(event) => updateField("gender", event.target.value)} disabled={!isEditing}>
                  <option value="">Prefer not to say</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                  <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                </Select>
              </div>
              <Input label="Phone Number" value={form.phone_number} onChange={(event) => updateField("phone_number", event.target.value)} disabled={!isEditing} />
              <Input label="Address" value={form.address} onChange={(event) => updateField("address", event.target.value)} disabled={!isEditing} />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Additional Preferences</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Preferred Language</label>
                <Select value={form.preferred_language} onChange={(event) => updateField("preferred_language", event.target.value)} disabled={!isEditing}>
                  <option value="">Select language</option>
                  <option value="en">English</option>
                  <option value="fr">French</option>
                  <option value="ar">Arabic</option>
                </Select>
              </div>
              <Input label="Profile Picture URL" value={form.profile_picture_url} onChange={(event) => updateField("profile_picture_url", event.target.value)} disabled={!isEditing} />
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
