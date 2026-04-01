import { expect, type Page } from "@playwright/test";

export type UserRole = "STUDENT" | "TEACHER" | "ADMIN" | "SUPERADMIN";

export interface MockUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  establishment_id: string | null;
  filiere: string | null;
  level: string | null;
  onboarding_completed: boolean;
  created_at: string;
}

export const studentUser: MockUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "student@atlas.tn",
  full_name: "Atlas Student",
  role: "STUDENT",
  is_active: true,
  is_verified: true,
  establishment_id: null,
  filiere: "INFO",
  level: "L3",
  onboarding_completed: true,
  created_at: "2026-01-01T10:00:00Z",
};

export const teacherUser: MockUser = {
  id: "33333333-3333-3333-3333-333333333333",
  email: "teacher@atlas.tn",
  full_name: "Atlas Teacher",
  role: "TEACHER",
  is_active: true,
  is_verified: true,
  establishment_id: null,
  filiere: null,
  level: null,
  onboarding_completed: true,
  created_at: "2026-01-01T10:00:00Z",
};

export const adminUser: MockUser = {
  id: "22222222-2222-2222-2222-222222222222",
  email: "admin@atlas.tn",
  full_name: "Atlas Admin",
  role: "ADMIN",
  is_active: true,
  is_verified: true,
  establishment_id: null,
  filiere: null,
  level: null,
  onboarding_completed: true,
  created_at: "2026-01-01T10:00:00Z",
};

export async function mockLogin(page: Page, user: MockUser): Promise<void> {
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

export async function mockAuthenticatedPage(
  page: Page,
  user: MockUser,
  options?: {
    notifications?: Array<{
      id: string;
      title: string;
      message: string;
      is_read: boolean;
      created_at: string;
      contribution_id?: string | null;
    }>;
    courses?: Array<{
      id: string;
      title: string;
      code: string;
      description?: string;
      level?: string;
    }>;
    contributions?: Array<{
      id: string;
      title: string;
      status: string;
      created_at: string;
    }>;
  },
): Promise<void> {
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

  if (options?.courses) {
    await page.route("**/api/v1/courses?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: options.courses,
          meta: {
            total: options.courses?.length ?? 0,
            limit: 20,
            offset: 0,
            has_more: false,
          },
        }),
      });
    });
  }

  if (options?.contributions) {
    await page.route("**/api/v1/contributions?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: options.contributions,
          meta: {
            total: options.contributions?.length ?? 0,
            limit: 20,
            offset: 0,
            has_more: false,
          },
        }),
      });
    });
  }
}

export async function loginThroughUi(page: Page, user: MockUser): Promise<void> {
  await mockLogin(page, user);
  await page.goto("/auth/login");
  await page.getByLabel(/Email/i).fill(user.email);
  await page.getByLabel(/Password/i).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/auth\/login/);
}

export async function mockStudyTools(page: Page): Promise<void> {
  await page.route("**/api/v1/study/flashcards/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "deck-1",
        title: "Test Flashcard Deck",
        cards: [
          { id: "card-1", front: "What is React?", back: "A JavaScript library for building UIs" },
          { id: "card-2", front: "What is useState?", back: "A React hook for state management" },
          { id: "card-3", front: "What is JSX?", back: "JavaScript XML syntax extension" },
          { id: "card-4", front: "What is Next.js?", back: "A React framework for production" },
          { id: "card-5", front: "What is TypeScript?", back: "A typed superset of JavaScript" },
        ],
      }),
    });
  });

  await page.route("**/api/v1/study/quizzes/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "quiz-1",
        title: "Test Quiz",
        questions: [
          {
            id: "q-1",
            question: "What is React?",
            options: ["A library", "A framework", "A language", "A database"],
            correctIndex: 0,
            explanation: "React is a JavaScript library for building user interfaces.",
          },
          {
            id: "q-2",
            question: "What hook manages state?",
            options: ["useEffect", "useState", "useContext", "useReducer"],
            correctIndex: 1,
            explanation: "useState is the primary hook for state management in React.",
          },
          {
            id: "q-3",
            question: "Next.js uses which rendering pattern?",
            options: ["CSR only", "SSR only", "Multiple patterns", "Static only"],
            correctIndex: 2,
            explanation: "Next.js supports SSR, SSG, CSR, and ISR.",
          },
          {
            id: "q-4",
            question: "TypeScript adds what to JavaScript?",
            options: ["Types", "Classes", "Modules", "All of the above"],
            correctIndex: 3,
            explanation: "TypeScript adds static typing and other features.",
          },
          {
            id: "q-5",
            question: "JSX stands for?",
            options: ["JavaScript XML", "Java Syntax Extension", "JSON XML", "Java Standard"],
            correctIndex: 0,
            explanation: "JSX is JavaScript XML, a syntax extension.",
          },
        ],
      }),
    });
  });
}

export async function mockSearchResults(page: Page, query: string, results: Array<{ id: string; title: string; description?: string }>): Promise<void> {
  await page.route("**/api/v1/search?**", async (route) => {
    const url = new URL(route.request().url());
    const searchQuery = url.searchParams.get("q");
    if (searchQuery === query) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          hits: results.map((r) => ({ ...r, _matchesPosition: {} })),
          query: searchQuery,
          processingTimeMs: 15,
          hitsCount: results.length,
        }),
      });
    } else {
      await route.fallback();
    }
  });
}

export async function mockRagStream(page: Page): Promise<void> {
  await page.route("**/api/v1/rag/sessions/*/messages", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "msg-1",
        content: "useEffect is a React Hook that lets you synchronize a component with an external system.",
        role: "assistant",
        created_at: new Date().toISOString(),
      }),
    });
  });
}
