import { expect, test, type Page } from "@playwright/test";
import type { Report } from "@/types/api.types";

type MockUser = {
  id: string;
  email: string;
  full_name: string;
  role: "STUDENT" | "ADMIN";
  is_active: boolean;
  is_verified: boolean;
  establishment_id: string | null;
  filiere: string | null;
  niveau: string | null;
  created_at: string;
};

const studentUser: MockUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "student@atlas.tn",
  full_name: "Atlas Student",
  role: "STUDENT",
  is_active: true,
  is_verified: true,
  establishment_id: null,
  filiere: "INFO",
  niveau: "L3",
  created_at: "2026-01-01T10:00:00Z",
};

const adminUser: MockUser = {
  id: "22222222-2222-2222-2222-222222222222",
  email: "admin@atlas.tn",
  full_name: "Atlas Admin",
  role: "ADMIN",
  is_active: true,
  is_verified: true,
  establishment_id: null,
  filiere: null,
  niveau: null,
  created_at: "2026-01-01T10:00:00Z",
};

async function mockLogin(page: Page, user: MockUser) {
  await page.route("**/api/v1/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessToken: "test-access-token",
        refreshToken: "test-refresh-token",
        user,
      }),
    });
  });
}

async function loginThroughUi(page: Page, user: MockUser) {
  await mockLogin(page, user);
  await page.goto("/auth/login");
  await page.getByLabel(/Email/i).fill(user.email);
  await page.getByLabel(/Password/i).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/auth\/login/);
}

async function mockAuthenticatedPage(
  page: Page,
  user: MockUser,
  options?: {
    notifications?: Array<{
      id: string;
      title: string;
      message: string;
      is_read: boolean;
      created_at: string;
    }>;
    reports?: Array<{
      id: string;
      title: string;
      description: string;
      type?: string;
      severity?: string | null;
      status?: "PENDING" | "RESOLVED";
      is_resolved: boolean;
      created_at: string;
      screenshot_url?: string | null;
    }>;
  },
) {
  await mockLogin(page, user);

  await page.route("**/api/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(user),
    });
  });

  await page.route("**/api/v1/notifications?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: options?.notifications ?? [],
        meta: {
          total: options?.notifications?.length ?? 0,
          limit: 20,
          offset: 0,
          has_more: false,
        },
      }),
    });
  });

  await page.route("**/api/v1/admin/reports?**", async (route) => {
    const reports = options?.reports ?? [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: reports,
        meta: {
          total: reports.length,
          limit: 50,
          offset: 0,
          has_more: false,
        },
      }),
    });
  });
}

test.describe("Production Hardening Coverage", () => {
  test("login sends the JSON auth contract with email and password", async ({
    page,
  }) => {
    let capturedBody: Record<string, unknown> | null = null;

    await page.route("**/api/v1/auth/login", async (route) => {
      capturedBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "test-access-token",
          refreshToken: "test-refresh-token",
          user: studentUser,
        }),
      });
    });

    await page.goto("/auth/login");
    await page.getByLabel("Email").fill("student@atlas.tn");
    await page.getByLabel("Password").fill("StudentPass123!");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect.poll(() => capturedBody).not.toBeNull();
    expect(capturedBody).toEqual({
      email: "student@atlas.tn",
      password: "StudentPass123!",
    });
  });

  test("feedback submission posts a real report payload and shows success", async ({
    page,
  }) => {
    let capturedBody: Record<string, unknown> | null = null;

    await page.route("**/api/v1/reports", async (route) => {
      capturedBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "report-1",
          message: "Feedback submitted successfully.",
        }),
      });
    });

    await page.goto("/feedback");
    await page.getByRole("button", { name: "Bug Report" }).click();
    await page
      .getByPlaceholder("Brief description of the issue")
      .fill("Flashcard review freezes");
    await page
      .getByPlaceholder("Provide detailed information...")
      .fill("When I review flashcards on mobile, the page freezes after the second card.");
    await page.getByRole("button", { name: "Critical" }).click();
    await page.getByRole("button", { name: "Submit Feedback" }).click();

    await expect(page.getByText("Thank you")).toBeVisible();
    expect(capturedBody).toEqual({
      type: "bug",
      title: "Flashcard review freezes",
      description:
        "When I review flashcards on mobile, the page freezes after the second card.",
      severity: "critical",
    });
  });

  test("admin reports page renders live reports and resolves a report", async ({
    page,
  }) => {
    let reportState: Report[] = [
      {
        id: "report-1",
        title: "Broken upload status",
        description: "Teachers see PROCESSING forever after upload.",
        type: "bug",
        severity: "high",
        status: "PENDING",
        is_resolved: false,
        created_at: "2026-04-01T10:00:00Z",
        screenshot_url: null,
      },
    ];

    await mockAuthenticatedPage(page, adminUser, { reports: reportState });
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

    await page.route("**/api/v1/admin/reports/report-1", async (route) => {
      if (route.request().method() === "PATCH") {
        reportState = reportState.map((report) => ({
          ...report,
          status: "RESOLVED",
          is_resolved: true,
        }));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "report-1",
            resolved: true,
            message: "Report marked as resolved with action 'dismiss'.",
          }),
        });
        return;
      }

      await route.fallback();
    });

    await page.route("**/api/v1/admin/reports?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: reportState,
          meta: {
            total: reportState.length,
            limit: 50,
            offset: 0,
            has_more: false,
          },
        }),
      });
    });

    await loginThroughUi(page, adminUser);
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await page.getByRole("link", { name: "Reports" }).click();
    await expect(page.getByText("Broken upload status")).toBeVisible();
    await expect(page.getByText("Severity: High")).toBeVisible();

    await page.getByRole("button", { name: "Mark Resolved" }).first().click();
    await expect(
      page.getByRole("button", { name: "Resolved", exact: true }).first(),
    ).toBeVisible();
  });

  test("notifications badge updates when a websocket notification arrives", async ({
    page,
  }) => {
    await mockAuthenticatedPage(page, adminUser, { notifications: [] });
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
    await mockLogin(page, adminUser);
    await page.goto("/auth/login");
    await page.evaluate(() => {
      class MockWebSocket {
        static OPEN = 1;
        readyState = 1;
        onopen: ((event: Event) => void) | null = null;
        onmessage: ((event: MessageEvent<string>) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;
        onclose: ((event: CloseEvent) => void) | null = null;

        constructor(url: string) {
          window.setTimeout(() => {
            this.onopen?.(new Event("open"));
            if (url.includes("/ws/notifications/")) {
              this.onmessage?.(
                new MessageEvent("message", {
                  data: JSON.stringify({
                    id: "notif-live-1",
                    user_id: "22222222-2222-2222-2222-222222222222",
                    type: "REPORT",
                    title: "New report received",
                    message: "A new critical report was submitted.",
                    is_read: false,
                    created_at: "2026-04-01T10:15:00Z",
                  }),
                }),
              );
            }
          }, 100);
        }

        send() {}
        close() {
          this.onclose?.(new CloseEvent("close"));
        }
      }

      // @ts-expect-error test shim
      window.WebSocket = MockWebSocket;
    });
    await page.getByLabel(/Email/i).fill(adminUser.email);
    await page.getByLabel(/Password/i).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    const notificationsButton = page.locator("button[aria-label='Notifications']");
    await expect(notificationsButton).toBeVisible();
    await expect(page.locator("button[aria-label='Notifications'] span")).toHaveText(
      "1",
    );
  });
});
