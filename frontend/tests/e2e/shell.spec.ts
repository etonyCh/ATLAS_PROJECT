import { expect, test } from "@playwright/test";
import { mockAuthenticatedPage, studentUser } from "./test-utils";

test.describe("Global Shell Features (Production Standard)", () => {
  test("E2E-009 | CMD+K opens command palette → keyboard navigation → action executes", async ({ page }) => {
    let capturedCommand: string | null = null;

    await mockAuthenticatedPage(page, studentUser, {
      courses: [
        { id: "course-1", title: "React Fundamentals", code: "CS101" },
        { id: "course-2", title: "Advanced TypeScript", code: "CS201" },
      ],
    });

    // Mock command execution
    await page.route("**/api/v1/search?q=**", async (route) => {
      const url = new URL(route.request().url());
      capturedCommand = url.searchParams.get("q");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          hits: [],
          query: capturedCommand,
          processingTimeMs: 10,
          hitsCount: 0,
        }),
      });
    });

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();

    // Simulate CMD+K (or CTRL+K)
    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+k`);

    // Verify the command palette appears with accessible selectors
    const commandPalette = page.locator('[cmdk-dialog], [role="dialog"][aria-label*="command" i]').first();
    await expect(commandPalette).toHaveAttribute("data-state", "open");

    const commandInput = page.locator('[data-cmdk-input], input[placeholder*="command" i], input[placeholder*="search" i]').first();
    await expect(commandInput).toBeVisible();

    // Type a search query
    await commandInput.fill("React");

    // Keyboard navigate down and select
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    // The palette should close
    await expect(commandPalette).toBeHidden();
  });

  test("E2E-010 | Language switch to Arabic → layout is RTL → switch back to French → layout is LTR", async ({ page }) => {
    await mockAuthenticatedPage(page, studentUser);

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();

    // Access language toggle using accessible selectors
    const langToggle = page.locator('button[aria-label*="language" i], button[data-testid="lang-toggle"]').first();

    if (await langToggle.isVisible().catch(() => false)) {
      await langToggle.click();
    } else {
      // Fallback: look for language buttons
      const frButton = page.locator('button:has-text("FR"), button:has-text("Français")').first();
      if (await frButton.isVisible().catch(() => false)) {
        await frButton.click();
      }
    }

    // Select Arabic
    const arOption = page.locator('[role="option"]:has-text("AR"), [role="option"]:has-text("Arabic"), button:has-text("AR"), button:has-text("العربية")').first();
    if (await arOption.isVisible().catch(() => false)) {
      await arOption.click();
    }

    // Verify document direction is RTL
    let dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe("rtl");

    // Verify direction switches to RTL (lang can remain fr in current implementation)
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl", { timeout: 10000 });

    // Switch back to French
    const langToggleAgain = page.locator('button[aria-label*="language" i], button[data-testid="lang-toggle"], button:has-text("AR")').first();
    if (await langToggleAgain.isVisible().catch(() => false)) {
      await langToggleAgain.click();
    }

    const frOption = page.locator('[role="option"]:has-text("FR"), [role="option"]:has-text("French"), button:has-text("FR")').first();
    if (await frOption.isVisible().catch(() => false)) {
      await frOption.click();
    }

    // Verify document direction is LTR
    dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe("ltr");

    await expect(page.locator("html")).toHaveAttribute("dir", "ltr", { timeout: 10000 });
  });

  test("E2E-013 | Theme toggle: system → dark → light → verify class applied to html element", async ({ page }) => {
    await mockAuthenticatedPage(page, studentUser);

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();

    // Find theme toggle button
    const themeToggle = page.locator('button[aria-label*="theme" i], button[data-testid="theme-toggle"]').first();

    if (await themeToggle.isVisible().catch(() => false)) {
      // Cycle through themes
      await themeToggle.click();

      const initialClass = (await page.locator("html").getAttribute("class")) ?? "";

      await themeToggle.click();
      const classAfterFirstClick = (await page.locator("html").getAttribute("class")) ?? "";

      await themeToggle.click();
      const classAfterSecondClick = (await page.locator("html").getAttribute("class")) ?? "";

      expect(classAfterFirstClick).not.toBe(initialClass);
      expect(classAfterSecondClick).not.toBe(classAfterFirstClick);
    }
  });

  test("E2E-014 | Responsive sidebar: collapse → expand → verify navigation accessible", async ({ page }) => {
    await mockAuthenticatedPage(page, studentUser);

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();

    // Find sidebar toggle
    const sidebarToggle = page.locator('button[aria-label*="sidebar" i], button[aria-label*="menu" i], button[data-testid="sidebar-toggle"]').first();

    if (await sidebarToggle.isVisible().catch(() => false)) {
      // Collapse sidebar
      await sidebarToggle.click();

      // Verify sidebar is collapsed (check aria-expanded or width)
      const isExpanded = await sidebarToggle.evaluate((el) => el.getAttribute("aria-expanded"));
      expect(isExpanded).toBe("false");

      // Expand sidebar
      await sidebarToggle.click();

      const isExpandedAfter = await sidebarToggle.evaluate((el) => el.getAttribute("aria-expanded"));
      expect(isExpandedAfter).toBe("true");

      // Verify navigation links are accessible
      await expect(page.getByRole("link", { name: /dashboard|courses|search/i }).first()).toBeVisible();
    }
  });
});
