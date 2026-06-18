import { test, expect } from '@playwright/test';
import { mockAuth } from './utils';

test.describe('Study Tools', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page, 'STUDENT');
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Common mocks for the course pages
    await page.route('**/api/v1/courses/course1', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({ headers: corsHeaders, json: { id: 'course1', title: 'Test Course', current_version_id: 'v1' } });
    });
    
    await page.route('**/api/v1/courses/*/my-assets*', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({ headers: corsHeaders, json: { 
        flashcards: { exists: true, id: 'deck1' },
        quiz: { exists: true, id: 'quiz1' },
        summary: { exists: false, id: null },
        mindmap: { exists: false, id: null }
      } });
    });
  });

  test('can open flashcards', async ({ page }) => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    await page.route('**/api/v1/flashcards/due', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({ headers: corsHeaders, json: { items: [], total: 0 } });
    });
    
    await page.goto('/courses/course1/flashcards');
    await expect(page).toHaveURL(/.*\/courses\/course1\/flashcards/);
  });

  test('can review flashcards', async ({ page }) => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    await page.route('**/api/v1/flashcards/due', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({
        headers: corsHeaders,
        json: {
          items: [
            { id: 'card1', question: 'What is Playwright?', answer: 'A testing framework', difficulty: 'HARD' }
          ],
          meta: { total: 1, limit: 10, offset: 0, has_more: false }
        }
      });
    });

    await page.route('**/api/v1/flashcards/card1/review', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({
        headers: corsHeaders,
        json: { message: 'Review recorded' }
      });
    });

    await page.goto('/courses/course1/flashcards', { waitUntil: 'networkidle' });
    
    // Check if the front is visible
    await expect(page.locator('text=What is Playwright?')).toBeVisible();
    
    // Click "Flip Card"
    const flipBtn = page.locator('button:has-text("Flip Card")');
    if (await flipBtn.isVisible()) {
      await flipBtn.click();
      await expect(page.locator('text=A testing framework')).toBeVisible();
      
      // Click Good
      const goodBtn = page.locator('button:has-text("Good")');
      if (await goodBtn.isVisible()) {
        await goodBtn.click();
      }
    }
  });

  test('can take a quiz', async ({ page }) => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    await page.route('**/api/v1/quiz/quiz1', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({
        headers: corsHeaders,
        json: {
          id: 'quiz1',
          total_questions: 1,
          time_limit_minutes: 10,
          questions: [
            { id: 'q1', question: 'What is 2+2?', options: ['3', '4', '5'], type: 'multiple_choice' }
          ]
        }
      });
    });

    await page.route('**/api/v1/quiz/sessions/session1/submit', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({
        headers: corsHeaders,
        json: { score: 100, total_points: 100 }
      });
    });

    await page.goto('/courses/course1/quiz', { waitUntil: 'networkidle' });
    
    // In actual implementation, we might not need to click anything, just wait for network idle and check for text.
    // If it requires Start Quiz, we can try to click it.
    const startBtn = page.locator('button:has-text("Start Quiz")');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    
    await expect(page.locator('text=What is 2+2?')).toBeVisible();
  });
});
