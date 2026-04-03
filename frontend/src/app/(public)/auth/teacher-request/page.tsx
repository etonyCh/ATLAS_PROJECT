import type { Metadata } from "next";
import { TeacherRequestPageClient } from "./teacher-request-page-client";

export const metadata: Metadata = {
  title: "Teacher Verification Request",
  description: "Request educator access with your institutional email and complete ATLAS verification.",
};

export default function TeacherRequestPage() {
  return <TeacherRequestPageClient />;
}
