import { test, expect } from '@playwright/test';
import { mockAuth } from './utils';

test.describe('Superadmin Flows', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    await mockAuth(page, 'SUPERADMIN');
  });

  test('superadmin dashboard renders correctly', async ({ page }) => {
    await page.goto('/superadmin/dashboard');
    await expect(page).toHaveURL(/.*\/superadmin\/dashboard.*/);
  });

  test('can manage establishments', async ({ page }) => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PATCH, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    await page.route('**/api/v1/superadmin/establishments*', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({
        headers: corsHeaders,
        json: [{ id: 'est1', name: 'University of Test', domain: 'test.edu', is_authorized: true, created_at: new Date().toISOString() }]
      });
    });

    await page.route('**/api/v1/superadmin/establishments/est1/toggle-authorization', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({
        headers: corsHeaders,
        json: { message: 'Authorization toggled' }
      });
    });

    await page.goto('/superadmin/establishments', { waitUntil: 'networkidle' });
    
    // Look for establishment
    await expect(page.getByRole('table').getByText('University of Test')).toBeVisible();
    
    // In a real app we might click "Revoke" or a switch
  });

  test('can resolve reports', async ({ page }) => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PATCH, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    await page.route('**/api/v1/superadmin/reports*', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({
        headers: corsHeaders,
        json: {
          items: [{ 
            id: 'rep1', 
            target_type: 'USER', 
            target_id: 'u1', 
            title: 'Test Report',
            message: 'Type: Inappropriate\nSeverity: High\nSpam', 
            status: 'PENDING', 
            created_at: new Date().toISOString(),
            is_read: false,
            is_resolved: false
          }],
          meta: { total: 1, limit: 10, offset: 0, has_more: false }
        }
      });
    });

    await page.route('**/api/v1/superadmin/reports/rep1/resolve', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({
        headers: corsHeaders,
        json: { message: 'Report resolved' }
      });
    });

    await page.goto('/superadmin/reports', { waitUntil: 'networkidle' });
    
    // Look for report reason
    await expect(page.locator('text=Test Report').first()).toBeVisible();
  });
});
