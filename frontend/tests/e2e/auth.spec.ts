import { test, expect } from '@playwright/test';
import { mockUnauthenticated, mockAuth } from './utils';

test.describe('Authentication Flows', () => {
  test('redirects unauthenticated users from protected routes to login', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    await page.route('**/api/v1/auth/login', async route => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      await route.fulfill({ headers: corsHeaders, json: { accessToken: 'mocked_token', user: { role: 'STUDENT', onboarding_completed: true, status: 'ACTIVE' } } });
    });
    await page.route('**/api/v1/auth/me', async route => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      await route.fulfill({ headers: corsHeaders, json: { role: 'STUDENT', onboarding_completed: true, status: 'ACTIVE' } });
    });

    await page.goto('/auth/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
  });

  test('displays error on invalid credentials', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('request', req => console.log('REQ:', req.method(), req.url()));
    page.on('response', res => console.log('RES:', res.status(), res.url()));

    const corsHeaders = {
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    await page.route('**/api/v1/auth/login', async route => {
      console.log('INTERCEPTED LOGIN:', route.request().method());
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      await route.fulfill({ status: 401, headers: corsHeaders, json: { error: { message: 'Invalid credentials' } } });
    });

    await page.goto('/auth/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button[type="submit"]');

    await expect(page.locator('.bg-destructive\\/10')).toBeVisible({ timeout: 15000 });
  });

  test('successful registration redirects to OTP activation', async ({ page }) => {
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
        json: {
          universities: [{ id: 'uni1', name: 'Test University' }],
          departments: [{ id: 'dep1', name: 'Test Department', establishment_id: 'uni1' }]
        }
      });
    });

    await page.route('**/api/v1/auth/majors/*', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({
        headers: corsHeaders,
        json: [{ id: 'maj1', name: 'Test Major', department_id: 'dep1', level: '1' }]
      });
    });

    await page.route('**/api/v1/auth/register', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({
        headers: corsHeaders,
        json: { user: { id: 'usr1', email: 'new@example.com' } }
      });
    });

    await page.goto('/auth/register', { waitUntil: 'networkidle' });
    
    await page.locator('input[type="text"]').fill('New Student');
    await page.locator('input[type="email"]').fill('new@example.com');
    
    await page.locator('text=Select a university...').click();
    await page.locator('text=Test University').click();

    await page.locator('text=Select a department...').click();
    await page.locator('text=Test Department').click();

    await page.locator('text=Select your major...').click();
    await page.locator('text=Test Major (1)').click();

    await page.locator('input[type="password"]').first().fill('StrongPass123!');
    await page.locator('input[type="password"]').nth(1).fill('StrongPass123!');

    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/.*\/activate\/student.*/, { timeout: 15000 });
  });

  test('password recovery shows success state', async ({ page }) => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    await page.route('**/api/v1/auth/request-otp', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({
        headers: corsHeaders,
        json: { message: 'OTP sent' }
      });
    });

    await page.goto('/auth/forgot-password', { waitUntil: 'networkidle' });
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('text=Check your email')).toBeVisible();
    await page.locator('button:has-text("Continue")').click();
    await expect(page).toHaveURL(/.*\/auth\/reset-password.*/, { timeout: 15000 });
  });
});
