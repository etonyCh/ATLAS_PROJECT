import { test, expect } from '@playwright/test';
import { mockAuth } from './utils';

test.describe('Student Flows', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page, 'STUDENT');
  });

  test('dashboard renders correctly', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*\/dashboard.*/);
  });

  test('can navigate to courses', async ({ page }) => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    await page.route('**/api/v1/courses*', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({ headers: corsHeaders, json: { items: [], meta: { total: 0 } } });
    });
    
    await page.goto('/courses');
    await expect(page).toHaveURL(/.*\/courses/);
  });
});
