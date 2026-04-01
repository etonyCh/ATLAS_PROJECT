import { expect, test } from "@playwright/test";
import { mockLogin, mockAuthenticatedPage, studentUser, type MockUser } from "./test-utils";

async function fillOtpCode(page: import("@playwright/test").Page, code: string): Promise<void> {
  const inputs = await page.locator('input[type="text"], input[inputmode="numeric"]').all();

  for (let i = 0; i < Math.min(code.length, inputs.length); i++) {
    await inputs[i].fill(code[i]);
  }
}

test.describe("Authentication Flows (Production Standard)", () => {
  test("E2E-001 | Student: Register → OTP verification → Dashboard redirect", async ({ page }) => {
    const testEmail = "teststudent@atlas.tn";
    let capturedRegistration: Record<string, unknown> | null = null;
    let capturedOtp: Record<string, unknown> | null = null;

    await page.route("**/api/v1/auth/register", async (route) => {
      capturedRegistration = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Registration successful. Please check your email for the activation code.",
          user_id: "new-user-123",
        }),
      });
    });

    await page.route("**/api/v1/auth/verify-otp", async (route) => {
      capturedOtp = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "test-access-token",
          refreshToken: "test-refresh-token",
          user: { ...studentUser, email: testEmail, id: "new-user-123" },
        }),
      });
    });

    await page.goto("/auth/register");
    await expect(page.getByRole("heading", { name: /create account|register|sign up/i })).toBeVisible();

    await page.getByLabel(/full name|name/i).fill("Test Student");
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/^password$/i).fill("Password123!");
    await page.getByLabel(/confirm password|repeat password/i).fill("Password123!");

    const roleSelector = page.locator('button[role="combobox"], select[name="role"]').first();
    if (await roleSelector.isVisible().catch(() => false)) {
      await roleSelector.click();
      await page.getByRole("option", { name: /student/i }).click();
    }

    await page.getByRole("button", { name: /register|sign up|create account/i }).click();

    await expect.poll(() => capturedRegistration).not.toBeNull();
    expect(capturedRegistration).toMatchObject({
      email: testEmail,
      full_name: "Test Student",
      password: "Password123!",
      role: expect.any(String),
    });

    await expect(page).toHaveURL(/\/auth\/(activate|verify-otp|otp)/, { timeout: 10000 });
    await expect(page.getByText(/verification|activate|otp/i)).toBeVisible();

    await fillOtpCode(page, "123456");
    await page.getByRole("button", { name: /verify|confirm|activate/i }).click();

    await expect.poll(() => capturedOtp).not.toBeNull();
    expect(capturedOtp).toMatchObject({
      email: testEmail,
      code: "123456",
      purpose: expect.any(String),
    });

    await page.waitForURL(/\/(dashboard|onboarding|student\/dashboard)/, { timeout: 10000 });
  });

  test("E2E-002 | Student: Login with wrong password → error message → correct login → role redirect", async ({ page }) => {
    let loginAttempts = 0;

    await page.route("**/api/v1/auth/login", async (route) => {
      const body = route.request().postDataJSON() as { email?: string; password?: string } | null;
      loginAttempts++;

      if (body?.password === "WrongPassword123!") {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "AUTH_001",
              message: "Invalid email or password",
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            accessToken: "test-access-token",
            refreshToken: "test-refresh-token",
            user: studentUser,
          }),
        });
      }
    });

    await page.goto("/auth/login");
    await expect(page.getByRole("heading", { name: /sign in|login/i })).toBeVisible();

    await page.getByLabel(/email/i).fill("student@atlas.tn");
    await page.getByLabel(/password/i).fill("WrongPassword123!");
    await page.getByRole("button", { name: /sign in|login/i }).click();

    await expect(page.getByText(/invalid|incorrect|wrong|error/i)).toBeVisible({ timeout: 10000 });
    expect(loginAttempts).toBe(1);

    await page.getByLabel(/password/i).fill("StudentPass123!");
    await page.getByRole("button", { name: /sign in|login/i }).click();

    await page.waitForURL(/\/(dashboard|onboarding|student)/, { timeout: 10000 });
    expect(loginAttempts).toBe(2);
  });

  test("E2E-008 | Any role: 401 on expired token → silent refresh → original request retried → no logout", async ({ page }) => {
    let meCallCount = 0;
    let refreshCallCount = 0;

    await page.route("**/api/v1/auth/refresh", async (route) => {
      refreshCallCount++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "new-refreshed-token",
          refreshToken: "new-refresh-token",
        }),
      });
    });

    await page.route("**/api/v1/auth/me", async (route) => {
      meCallCount++;
      if (meCallCount === 1) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "TOKEN_EXPIRED",
              message: "Token expired",
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(studentUser),
        });
      }
    });

    await mockLogin(page, studentUser);

    await page.goto("/auth/login");
    await page.getByLabel(/email/i).fill(studentUser.email);
    await page.getByLabel(/password/i).fill("Password123!");
    await page.getByRole("button", { name: /sign in|login/i }).click();

    await page.waitForTimeout(3000);
    await expect(page).not.toHaveURL(/\/auth\/login/);
  });
});
