"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, Eye, EyeOff, GraduationCap, Loader2, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authApi } from "@/lib/api";
import type { StudentLevel } from "@/types/api.types";

const STUDENT_LEVELS: { value: StudentLevel; label: string }[] = [
  { value: "L1", label: "Licence 1" },
  { value: "L2", label: "Licence 2" },
  { value: "L3", label: "Licence 3" },
  { value: "M1", label: "Master 1" },
  { value: "M2", label: "Master 2" },
];

const FILIERES = [
  "Informatique",
  "Mathematiques",
  "Physique",
  "Chimie",
  "Biologie",
  "Sciences de la Terre",
  "Economie",
  "Droit",
  "Lettres",
  "Langues",
];

const PASSWORD_REQUIREMENTS = [
  { id: "length", label: "At least 8 characters", test: (password: string) => password.length >= 8 },
  { id: "upper", label: "One uppercase letter", test: (password: string) => /[A-Z]/.test(password) },
  { id: "lower", label: "One lowercase letter", test: (password: string) => /[a-z]/.test(password) },
  { id: "number", label: "One number", test: (password: string) => /\d/.test(password) },
];

export function RegisterPageClient() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [filiere, setFiliere] = useState("");
  const [level, setLevel] = useState<StudentLevel | "">("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const passwordsMatch = password === confirmPassword && confirmPassword !== "";
  const passwordStrong = PASSWORD_REQUIREMENTS.every((requirement) => requirement.test(password));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!passwordsMatch) {
      setError("Passwords do not match");
      return;
    }

    if (!passwordStrong) {
      setError("Password does not meet requirements");
      return;
    }

    if (!filiere || !level) {
      setError("Please select your filiere and level");
      return;
    }

    setIsLoading(true);

    try {
      await authApi.register({
        email,
        password,
        full_name: fullName,
        role: "STUDENT",
        filiere,
        level: level as StudentLevel,
      });
      router.push(`/auth/activate/student?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <GraduationCap className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Create Student Account</CardTitle>
            <CardDescription>Join ATLAS as a student and unlock your learning workspace</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-950">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-700" />
                <div className="space-y-1">
                  <p className="font-medium">Student self-registration</p>
                  <p className="text-blue-900/80">
                    Teacher accounts now go through institutional verification before activation.
                  </p>
                  <Link
                    href="/auth/teacher-request"
                    className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
                  >
                    I&apos;m a teacher
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>

            <Input
              type="text"
              label="Full Name"
              placeholder="Ahmed Ben Ali"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />

            <Input
              type="email"
              label="Email"
              placeholder="you@university.tn"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Filiere <span className="text-destructive">*</span>
              </label>
              <Select value={filiere} onChange={(event) => setFiliere(event.target.value)} required>
                <option value="">Select your filiere</option>
                {FILIERES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Level <span className="text-destructive">*</span>
              </label>
              <Select value={level} onChange={(event) => setLevel(event.target.value as StudentLevel)} required>
                <option value="">Select your level</option>
                {STUDENT_LEVELS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="space-y-1 rounded-lg bg-muted/50 p-3">
                {PASSWORD_REQUIREMENTS.map((requirement) => (
                  <div
                    key={requirement.id}
                    className={`flex items-center gap-2 text-xs ${
                      requirement.test(password) ? "text-success" : "text-muted-foreground"
                    }`}
                  >
                    {requirement.test(password) ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                    {requirement.label}
                  </div>
                ))}
              </div>
            </div>

            <Input
              type="password"
              label="Confirm Password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              autoComplete="new-password"
              className={confirmPassword && !passwordsMatch ? "border-destructive focus:border-destructive" : ""}
            />

            <Button type="submit" className="w-full" disabled={isLoading || !passwordsMatch || !passwordStrong}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link href="/auth/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </div>
          <div className="mt-2 text-center text-sm">
            <span className="text-muted-foreground">Need educator access? </span>
            <Link href="/auth/teacher-request" className="font-medium text-primary hover:underline">
              Request teacher verification
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
