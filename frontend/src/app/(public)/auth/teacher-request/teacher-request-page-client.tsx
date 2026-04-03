"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Building2, Eye, EyeOff, GraduationCap, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authApi } from "@/lib/api";

const PASSWORD_REQUIREMENTS = [
  { id: "length", label: "At least 8 characters", test: (password: string) => password.length >= 8 },
  { id: "upper", label: "One uppercase letter", test: (password: string) => /[A-Z]/.test(password) },
  { id: "lower", label: "One lowercase letter", test: (password: string) => /[a-z]/.test(password) },
  { id: "number", label: "One number", test: (password: string) => /\d/.test(password) },
];

function isInstitutionalEmail(email: string) {
  const [, domain = ""] = email.trim().toLowerCase().split("@");
  return Boolean(domain) && !["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"].includes(domain);
}

export function TeacherRequestPageClient() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const passwordsMatch = password === confirmPassword && confirmPassword !== "";
  const passwordStrong = PASSWORD_REQUIREMENTS.every((requirement) => requirement.test(password));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!isInstitutionalEmail(email)) {
      setError("Please use your institutional email address for teacher verification.");
      return;
    }

    if (!department.trim()) {
      setError("Please enter your department to help the admin verify your request.");
      return;
    }

    if (!passwordsMatch) {
      setError("Passwords do not match");
      return;
    }

    if (!passwordStrong) {
      setError("Password does not meet requirements");
      return;
    }

    setIsLoading(true);

    try {
      await authApi.createTeacherRequest({
        email,
        password,
        full_name: fullName,
        department,
      });
      router.push(
        `/auth/activate/teacher?email=${encodeURIComponent(email)}&department=${encodeURIComponent(
          department.trim(),
        )}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Teacher verification request failed");
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
            <CardTitle className="text-2xl font-bold">Teacher Verification Request</CardTitle>
            <CardDescription>
              Start with your institutional email. Your account stays pending until an admin approves it.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-left text-sm text-amber-950">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-amber-700" />
              <div className="space-y-1">
                <p className="font-medium">Verification-first educator onboarding</p>
                <p className="text-amber-900/80">
                  ATLAS no longer grants direct teacher access from the public signup form. Submit your request, verify your email, then wait for institutional approval.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <Input
              type="text"
              label="Full Name"
              placeholder="Dr. Ahmed Ben Ali"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />

            <Input
              type="email"
              label="Institutional Email"
              placeholder="you@university.tn"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />

            <Input
              type="text"
              label="Department"
              placeholder="Computer Science"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              required
            />

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
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                {PASSWORD_REQUIREMENTS.map((requirement) => (
                  <p key={requirement.id}>{requirement.label}</p>
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
            />

            <Button type="submit" className="w-full" disabled={isLoading || !passwordsMatch || !passwordStrong}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting request...
                </>
              ) : (
                <>
                  Request Verification
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-5 w-5 text-primary" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">What happens next?</p>
                <p>1. We send an OTP to your institutional email.</p>
                <p>2. You activate the request.</p>
                <p>3. Your institution admin reviews and approves access.</p>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Need a student account instead? </span>
            <Link href="/auth/register" className="font-medium text-primary hover:underline">
              Create student account
            </Link>
          </div>
          <div className="mt-2 text-center text-sm">
            <span className="text-muted-foreground">Already verified? </span>
            <Link href="/auth/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
