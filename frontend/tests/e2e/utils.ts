import { Page } from '@playwright/test';

export const API_BASE_URL = 'http://localhost:8000/api/v1';

export async function mockAuth(page: Page, role: 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPERADMIN' = 'STUDENT') {
  const user = {
    id: 'test-user-id',
    email: 'test@example.com',
    full_name: 'Test User',
    role,
    onboarding_completed: true,
    is_active: true,
    trust_score: 100,
    is_contributor: true,
  };

  page.on('response', response => {
    if (response.status() >= 400 && response.url().includes('/api/v1/')) {
      console.log('API ERROR:', response.status(), response.url());
    }
  });

  const corsHeaders = {
    'Access-Control-Allow-Origin': 'http://localhost:3000',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  await page.route('**/api/v1/auth/me', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
    await route.fulfill({ headers: corsHeaders, json: user });
  });

  // Mock notifications to prevent 401 from real backend which triggers logout
  await page.route('**/api/v1/notifications*', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
    return route.fulfill({ headers: corsHeaders, json: { items: [], meta: { total: 0 } } });
  });

  // Mock initial login redirect by setting local storage for both token and Zustand auth store
  await page.addInitScript((userData) => {
    window.localStorage.setItem('atlas_access_token', 'mocked_token');
    window.localStorage.setItem('atlas-auth', JSON.stringify({
      state: {
        user: userData,
        status: 'authenticated',
        hydrated: true,
        error: null
      },
      version: 0
    }));
  }, user);
}

export async function mockUnauthenticated(page: Page) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'http://localhost:3000',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  await page.route('**/api/v1/auth/me', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
    await route.fulfill({ status: 401, headers: corsHeaders, json: { detail: 'Not authenticated' } });
  });
}
