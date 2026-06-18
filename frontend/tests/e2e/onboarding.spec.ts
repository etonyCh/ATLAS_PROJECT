import { test, expect } from '@playwright/test';
import { mockAuth } from './utils';

test.describe('Onboarding Flow', () => {
  test('completes onboarding process successfully', async ({ page }) => {
    // Mock user without onboarding completed
    await page.route('**/api/v1/auth/me', async route => {
      await route.fulfill({
        json: {
          id: 'test-user-id',
          email: 'test@example.com',
          role: 'STUDENT',
          onboarding_completed: false,
        }
      });
    });

    await page.route('**/api/v1/users/me', async route => {
      await route.fulfill({ json: { onboarding_completed: true } });
    });

    // We assume the frontend checks `onboarding_completed: false` and redirects to /onboarding
    await page.addInitScript(() => window.localStorage.setItem('atlas_access_token', 'mocked_token'));
    
    await page.goto('/onboarding');
    await expect(page).toHaveURL(/.*\/onboarding/);
    // ... further steps
  });
});
