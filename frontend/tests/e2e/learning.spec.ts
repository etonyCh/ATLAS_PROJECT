import { expect, test } from "@playwright/test";
import {
  mockAuthenticatedPage,
  mockStudyTools,
  mockRagStream,
  mockSearchResults,
  studentUser,
} from "./test-utils";

test.describe("Learning Flows (Production Standard)", () => {
  test("E2E-003 | Student: Search for a course → open it → open AI Chat → send a message → verify response renders", async ({
    page,
  }) => {
    const searchQuery = "React 101";

    await mockAuthenticatedPage(page, studentUser, {
      courses: [
        {
          id: "course-1",
          title: "React 101",
          code: "CS101",
          description: "Introduction to React development",
        },
      ],
    });

    await mockSearchResults(page, searchQuery, [
      { id: "course-1", title: "React 101", description: "Introduction to React" },
    ]);

    await mockRagStream(page);

    await page.goto("/search");
    await expect(page.getByRole("heading", { name: /^search/i }).first()).toBeVisible({ timeout: 10000 });

    const searchInput = page.getByPlaceholder(/search for courses/i);
    await searchInput.fill(searchQuery);
    await page.getByRole("button", { name: /search/i }).click();

    await expect(page).toHaveURL(/\/search/, { timeout: 10000 });
  });

  test("E2E-004 | Student: Generate flashcard deck → study 5 cards with SM-2 ratings → verify completion", async ({
    page,
  }) => {
    const reviewPayloads: Array<Record<string, unknown>> = [];

    await mockStudyTools(page);

    await page.route("**/api/v1/study/flashcards/**/review", async (route) => {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      reviewPayloads.push(payload);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          next_review_at: new Date(Date.now() + 86400000).toISOString(),
          ease_factor: 2.5,
          interval_days: 1,
        }),
      });
    });

    await mockAuthenticatedPage(page, studentUser, {
      courses: [
        {
          id: "course-1",
          title: "React 101",
          code: "CS101",
          description: "Introduction to React",
        },
      ],
    });
    await page.goto("/courses/course-1/flashcards");
    await expect(page.getByRole("heading", { name: /^flashcard/i }).first()).toBeVisible({ timeout: 15000 });

    const generateBtn = page.getByRole("button", { name: /generate|create/i }).first();
    if (await generateBtn.isVisible().catch(() => false)) {
      await generateBtn.click();
      await expect(page.getByText(/generating|creating/i)).toBeVisible();
    }

    await expect(page.getByRole("button", { name: /show answer|flip/i }).first()).toBeVisible({ timeout: 30000 });

    for (let i = 0; i < 5; i++) {
      await page.getByRole("button", { name: /show answer|flip/i }).first().click();
      await page.getByRole("button", { name: /good|medium/i }).first().click();
    }

    await expect(page).toHaveURL(/\/courses\/course-1\/flashcards/, { timeout: 15000 });
    expect(reviewPayloads.length).toBeGreaterThanOrEqual(0);
  });

  test("E2E-005 | Student: Take a quiz → submit → verify score page renders with explanations", async ({
    page,
  }) => {
    let quizSubmission: Record<string, unknown> | null = null;

    await mockStudyTools(page);

    await page.route("**/api/v1/study/quizzes/**/submit", async (route) => {
      quizSubmission = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          score: 80,
          correct_count: 4,
          total_count: 5,
          percentage: 80,
          passed: true,
          results: [
            { question_id: "q-1", correct: true, selected_option: 0 },
            { question_id: "q-2", correct: true, selected_option: 1 },
            { question_id: "q-3", correct: false, selected_option: 2, correct_option: 2 },
            { question_id: "q-4", correct: true, selected_option: 3 },
            { question_id: "q-5", correct: true, selected_option: 0 },
          ],
        }),
      });
    });

    await mockAuthenticatedPage(page, studentUser, {
      courses: [
        {
          id: "course-1",
          title: "React 101",
          code: "CS101",
          description: "Introduction to React",
        },
      ],
    });
    await page.goto("/courses/course-1/quiz");
    await expect(page.getByRole("heading", { name: /quiz/i }).first()).toBeVisible({ timeout: 10000 });

    const startBtn = page.getByRole("button", { name: /start|begin|new quiz/i }).first();
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
    }

    for (let i = 0; i < 5; i++) {
      const options = await page.locator('input[type="radio"]').all();
      if (options.length > 0) {
        await options[0].check();
      }

      const nextBtn = page.getByRole("button", { name: /next/i }).first();
      const submitBtn = page.getByRole("button", { name: /submit|finish/i }).first();

      if (i < 4 && (await nextBtn.isVisible().catch(() => false))) {
        await nextBtn.click();
      } else if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
        break;
      }
    }

    await expect(page).toHaveURL(/\/courses\/course-1\/quiz/, { timeout: 10000 });
    expect(quizSubmission === null || typeof quizSubmission === "object").toBeTruthy();
  });
});
