import { expect, test } from "@playwright/test";
import {
  mockLogin,
  mockAuthenticatedPage,
  mockSearchResults,
  teacherUser,
  adminUser,
} from "./test-utils";

test.describe("Role Based Flows (Production Standard)", () => {
  test("E2E-006 | Teacher: Login → upload a PDF → verify status shows PROCESSING then INDEXED", async ({ page }) => {
    let uploadPayload: Record<string, unknown> | null = null;

    // Mock login and auth
    await mockLogin(page, teacherUser);

    // Mock dashboard data
    await page.route("**/api/v1/teacher/dashboard", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          total_uploads: 12,
          approved_contributions: 10,
          pending_contributions: 2,
          recent_activity: [],
        }),
      });
    });

    // Mock contributions list with status transitions
    let contributionStatus = "PROCESSING";
    await page.route("**/api/v1/contributions?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: "contrib-1",
              title: "hello.pdf",
              status: contributionStatus,
              document_type: "PDF",
              created_at: new Date().toISOString(),
            },
          ],
          meta: { total: 1, limit: 20, offset: 0, has_more: false },
        }),
      });
    });

    // Mock upload endpoint
    await page.route("**/api/v1/contributions/upload", async (route) => {
      if (route.request().method() === "POST") {
        uploadPayload = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "contrib-1",
            title: "hello.pdf",
            status: "PROCESSING",
            message: "Document uploaded successfully",
          }),
        });
      }
    });

    await page.goto("/auth/login");
    await expect(page.getByRole("heading", { name: /sign in|login/i })).toBeVisible();

    await page.getByLabel(/email/i).fill(teacherUser.email);
    await page.getByLabel(/password/i).fill("Password123!");
    await page.getByRole("button", { name: /sign in|login/i }).click();

    await page.waitForURL(/\/(teacher|dashboard)/, { timeout: 10000 });

    // Navigate to upload page
    await page.getByRole("link", { name: /upload|contribute/i }).first().click();
    await expect(page.getByRole("heading", { name: /upload|new contribution/i })).toBeVisible();

    // Upload file
    await page.setInputFiles('input[type="file"]', {
      name: "hello.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 mock pdf content"),
    });

    await page.getByRole("button", { name: /upload|submit/i }).click();

    // Verify upload payload captured
    await expect.poll(() => uploadPayload).not.toBeNull();

    // Verify PROCESSING status appears
    await expect(page.getByText(/processing|uploading/i)).toBeVisible({ timeout: 10000 });

    // Simulate status transition to INDEXED
    contributionStatus = "INDEXED";

    // Refresh to see updated status
    await page.reload();
    await expect(page.getByText(/indexed|ready|completed/i)).toBeVisible({ timeout: 15000 });
  });

  test("E2E-007 | Admin: Login → approve a contribution → verify it appears in search results", async ({ page }) => {
    let approvePayload: Record<string, unknown> | null = null;

    // Mock admin auth
    await mockAuthenticatedPage(page, adminUser, {
      courses: [],
    });

    // Mock admin dashboard
    await page.route("**/api/v1/admin/dashboard", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          total_users: 120,
          total_courses: 45,
          pending_contributions: 3,
        }),
      });
    });

    // Mock pending contributions
    const pendingContributions = [
      {
        id: "contrib-pending",
        title: "New Upload",
        description: "A new course material",
        status: "PENDING_REVIEW",
        author: { full_name: "Test Teacher", email: "teacher@atlas.tn" },
        created_at: new Date().toISOString(),
      },
    ];

    await page.route("**/api/v1/admin/contributions?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: pendingContributions,
          meta: { total: 1, limit: 50, offset: 0, has_more: false },
        }),
      });
    });

    // Mock approve endpoint
    await page.route("**/api/v1/admin/contributions/**/approve", async (route) => {
      if (route.request().method() === "POST" || route.request().method() === "PATCH") {
        approvePayload = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "contrib-pending",
            status: "APPROVED",
            message: "Contribution approved successfully",
          }),
        });
      }
    });

    // Mock search with approved contribution
    await mockSearchResults(page, "New Upload", [
      {
        id: "contrib-pending",
        title: "New Upload",
        description: "A new course material",
      },
    ]);

    // Login and navigate
    await mockLogin(page, adminUser);
    await page.goto("/auth/login");

    await page.getByLabel(/email/i).fill(adminUser.email);
    await page.getByLabel(/password/i).fill("Password123!");
    await page.getByRole("button", { name: /sign in|login/i }).click();

    await page.waitForURL(/\/admin\/dashboard/, { timeout: 10000 });

    // Navigate to contributions
    await page.getByRole("link", { name: /contributions|pending/i }).click();
    await expect(page.getByRole("heading", { name: /contributions|review/i })).toBeVisible();

    // Verify pending contribution visible
    await expect(page.getByText("New Upload")).toBeVisible();

    // Approve contribution
    await page.getByRole("button", { name: /approve|accept/i }).first().click();

    // Verify approval payload
    await expect.poll(() => approvePayload).not.toBeNull();

    // Verify success toast
    await expect(page.getByText(/approved|success/i)).toBeVisible({ timeout: 5000 });

    // Navigate to search and verify contribution appears
    await page.goto("/student/search");
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill("New Upload");
    await page.getByRole("button", { name: /search/i }).click();

    await expect(page.getByText(/found|results/i)).toBeVisible();
    await expect(page.getByText("New Upload")).toBeVisible({ timeout: 5000 });
  });
});
