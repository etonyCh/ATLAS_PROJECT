import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('displays hero section and CTA buttons', async ({ page }) => {
    await page.goto('/');
    // Make sure we select the logo link or header
    await expect(page.getByRole('link', { name: 'ATLAS' }).first()).toBeVisible();
    await expect(page.locator('text=Get Started').first()).toBeVisible();
  });

  test('navigates to login page when clicking Get Started', async ({ page }) => {
    await page.goto('/');
    await page.locator('text=Get Started').first().click();
    await expect(page).toHaveURL(/.*\/login|.*\/register/);
  });
});
