import { expect, test, type Page } from "@playwright/test";
import {
  mockAuthenticatedPage,
  studentUser,
  teacherUser,
} from "./test-utils";

const SAMPLE_PDF = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 72 72 Td (Atlas PDF Preview) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000063 00000 n 
0000000122 00000 n 
0000000208 00000 n 
trailer
<< /Root 1 0 R /Size 5 >>
startxref
302
%%EOF`;

async function mockPdfResponse(pageUrl: string, page: Page) {
  await page.route(pageUrl, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      body: SAMPLE_PDF,
    });
  });
}

test.describe("PDF Preview Flows", () => {
  test("Student course reader loads the shared PDF preview", async ({ page }) => {
    await mockAuthenticatedPage(page, studentUser, {
      courses: [
        {
          id: "course-1",
          title: "Algorithms",
          code: "CS101",
          description: "Algorithms course",
          latestVersion: {
            storage_path: "documents/course-1.pdf",
            mime_type: "application/pdf",
          },
        },
      ],
    });

    await mockPdfResponse("**/api/files/proxy/documents/course-1.pdf", page);

    await page.goto("/courses/course-1/read");

    await expect(page.getByRole("heading", { name: /document reader/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /open/i })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("link", { name: /download/i })).toBeVisible();
    await expect(page.getByText(/failed to load document/i)).toHaveCount(0);
  });

  test("Teacher contribution review loads the shared PDF preview", async ({ page }) => {
    await mockAuthenticatedPage(page, teacherUser);

    await page.route("**/api/v1/admin/contributions?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: "contrib-1",
              title: "Lecture Notes",
              description: "Week 1 notes",
              status: "PENDING",
              uploader_id: "student-1",
              created_at: new Date().toISOString(),
              s3_key: "documents/contribution-1.pdf",
              mime_type: "application/pdf",
              preview_text: "Week 1 notes",
            },
          ],
          meta: { total: 1, limit: 50, offset: 0, has_more: false },
        }),
      });
    });

    await mockPdfResponse("**/api/files/proxy/documents/contribution-1.pdf", page);

    await page.goto("/teacher/manage-contributions");

    await expect(page.getByRole("heading", { name: /manage contributions/i })).toBeVisible();
    await page.getByRole("button", { name: /review/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("link", { name: /open/i })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("link", { name: /download/i })).toBeVisible();
    await expect(page.getByText(/unable to load preview/i)).toHaveCount(0);
  });

  test("Teacher live session uses the real course PDF instead of a placeholder URL", async ({ page }) => {
    await mockAuthenticatedPage(page, teacherUser, {
      courses: [
        {
          id: "course-1",
          title: "Algorithms",
          code: "CS101",
          description: "Algorithms course",
          latestVersion: {
            storage_path: "documents/live-session.pdf",
            mime_type: "application/pdf",
          },
        },
      ],
    });

    await page.route("**/api/v1/courses/course-1/preview", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          course_id: "course-1",
          preview: {
            type: "document",
            url: "/api/v1/files/proxy/documents/live-session.pdf",
            mime_type: "application/pdf",
          },
        }),
      });
    });

    await mockPdfResponse("**/api/v1/files/proxy/documents/live-session.pdf", page);

    await page.goto("/live-session/session-1?mode=host&title=Algorithms%20Live&courseId=course-1");

    await expect(page.getByText(/algorithms live/i)).toBeVisible();
    await page.locator("button:has(svg.lucide-monitor)").last().click();
    await expect(page.getByText(/pdf sync active/i)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/algorithms/i).first()).toBeVisible();
    await expect(page.getByText(/page 1 of/i)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/live pdf preview unavailable/i)).toHaveCount(0);
  });
});
