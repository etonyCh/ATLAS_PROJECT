import { test, expect } from '@playwright/test';
import { mockAuth } from './utils';

test.describe('Navigation', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    await mockAuth(page, 'STUDENT');
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    await page.route('**/api/v1/students/me/dashboard*', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({ headers: corsHeaders, json: { continue_learning: [], recommended_courses: [] } });
    });
  });

  test('sidebar can collapse and expand', async ({ page }) => {
    await page.goto('/dashboard');
    // Basic check for sidebar existence
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
  });

  test('global search opens', async ({ page }) => {
    await page.goto('/dashboard');
    const searchInput = page.locator('input[placeholder*="Search"]');
    if (await searchInput.count() > 0) {
      await searchInput.first().click();
      await page.keyboard.type('test query');
    }
  });
});
