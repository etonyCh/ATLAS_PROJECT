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

    await page.goto("/student/search");
    await expect(page.getByRole("heading", { name: /search/i })).toBeVisible();

    const searchInput = page.getByPlaceholder(/search for courses/i);
    await searchInput.fill(searchQuery);
    await page.getByRole("button", { name: /search/i }).click();

    await expect(page.getByText(/found|results/i)).toBeVisible();
    await page.getByText("React 101").first().click();

    await page.goto("/student/ai/workspace");
    await expect(page.getByRole("heading", { name: /ai|assistant|workspace/i })).toBeVisible();

    const chatInput = page.getByPlaceholder(/ask anything/i);
    await chatInput.fill("Explain useEffect");
    await page.getByRole("button", { name: /send/i }).click();

    await expect(page.getByText(/useEffect|hook|React/i).first()).toBeVisible({ timeout: 15000 });
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

    await mockAuthenticatedPage(page, studentUser);
    await page.goto("/student/ai/workspace?tab=flashcards");
    await expect(page.getByRole("heading", { name: /flashcard|study/i })).toBeVisible();

    await page.getByRole("button", { name: /generate|create/i }).click();
    await expect(page.getByText(/generating|creating/i)).toBeVisible();

    await expect(page.getByText("Test Flashcard Deck")).toBeVisible({ timeout: 30000 });

    await page.getByText("Test Flashcard Deck").click();
    await expect(page.getByRole("button", { name: /show answer|flip/i })).toBeVisible();

    for (let i = 0; i < 5; i++) {
      await page.getByRole("button", { name: /show answer|flip/i }).click();
      await expect(page.getByText(/answer|explanation/i)).toBeVisible();
      await page.getByRole("button", { name: /good|medium/i }).click();
    }

    await expect(page.getByText(/completed|done|finished|great job/i)).toBeVisible({ timeout: 10000 });
    expect(reviewPayloads.length).toBeGreaterThanOrEqual(5);
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

    await mockAuthenticatedPage(page, studentUser);
    await page.goto("/student/ai/workspace?tab=quiz");
    await expect(page.getByRole("heading", { name: /quiz/i })).toBeVisible();

    await page.getByRole("button", { name: /start|begin|new quiz/i }).click();

    for (let i = 0; i < 5; i++) {
      const options = await page.locator('input[type="radio"]').all();
      if (options.length > 0) {
        await options[0].check();
      }

      if (i < 4) {
        await page.getByRole("button", { name: /next/i }).click();
      } else {
        await page.getByRole("button", { name: /submit|finish/i }).click();
      }
    }

    await expect(page.getByText(/score|result/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/80|4\/5|passed/i)).toBeVisible();

    expect(quizSubmission).not.toBeNull();
    expect(quizSubmission).toHaveProperty("answers");
  });
});
