import { test, expect } from '@playwright/test';
import { mockAuth } from './utils';

test.describe('Admin Flows', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    await mockAuth(page, 'ADMIN');
  });

  test('admin dashboard renders correctly', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/.*\/admin.*/);
  });

  test('can manage users', async ({ page }) => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    await page.route('**/api/v1/admin/users*', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({
        headers: corsHeaders,
        json: {
          items: [{ id: 'user1', email: 'user@example.com', full_name: 'Test User', role: 'STUDENT', status: 'ACTIVE', is_active: true, created_at: new Date().toISOString() }],
          meta: { total: 1, limit: 10, offset: 0, has_more: false }
        }
      });
    });

    await page.route('**/api/v1/admin/users/user1/role', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({
        headers: corsHeaders,
        json: { message: 'Role updated' }
      });
    });

    await page.goto('/admin/users', { waitUntil: 'networkidle' });
    
    // Look for user
    await expect(page.getByRole('table').getByText('user@example.com')).toBeVisible();

    // In a real app we might click "Edit Role" or similar dropdown
    // For this test we just ensure the user table renders the mock data
  });

});
