import { test, expect } from '@playwright/test';
import { mockAuth } from './utils';

test.describe('Teacher Flows', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page, 'TEACHER');
  });

  test('teacher dashboard renders correctly', async ({ page }) => {
    await page.goto('/teacher');
    await expect(page).toHaveURL(/.*\/teacher.*/);
  });

  test('can view pending contributor requests', async ({ page }) => {
    await page.route('**/api/v1/admin/contributor-requests*', async route => {
      await route.fulfill({ json: { items: [], meta: { total: 0 } } });
    });
    await page.goto('/teacher/contributor-requests');
    await expect(page).toHaveURL(/.*\/teacher\/contributor-requests.*/);
  });

  test('can upload a course', async ({ page }) => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    await page.route('**/api/v1/auth/registration-options', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({
        headers: corsHeaders,
        json: { departments: [{ id: 'dep1', name: 'Computer Science' }] }
      });
    });

    await page.route('**/api/v1/auth/majors/*', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({
        headers: corsHeaders,
        json: [{ id: 'maj1', name: 'Software Engineering', level: 'Master' }]
      });
    });

    await page.route('**/api/v1/courses?major_id=*', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({
        headers: corsHeaders,
        json: [{ id: 'course1', title: 'Algorithms 101' }]
      });
    });

    await page.route('**/api/v1/courses/my-uploads*', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({
        headers: corsHeaders,
        json: { items: [], meta: { total: 0 } }
      });
    });

    await page.route('**/api/v1/courses/upload', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({
        headers: corsHeaders,
        json: { id: 'new_course_doc' }
      });
    });

    await page.goto('/teacher/courses/upload', { waitUntil: 'networkidle' });

    // Select Department
    await page.locator('select').first().selectOption('dep1');
    // Select Major
    await page.locator('select').nth(1).selectOption('maj1');
    // Select Course
    await page.locator('select').nth(2).selectOption('course1');

    // Simulate file drop
    await page.locator('input[type="file"]').setInputFiles({
      name: 'test_lecture.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF dummy pdf content')
    });

    // Click submit
    await page.locator('button[type="submit"]').click();

    // Verify redirect
    await expect(page).toHaveURL(/.*\/teacher\/manage-courses.*/, { timeout: 15000 });
  });

  test('can view analytics', async ({ page }) => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    await page.route('**/api/v1/teacher/analytics*', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({
        headers: corsHeaders,
        json: { views: 100, downloads: 50, rating: 4.5 }
      });
    });

    await page.goto('/teacher/analytics', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/.*\/teacher\/analytics.*/);
  });
});
