/**
 * Home Page E2E Tests
 */

import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should display the home page', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle(/CreatorCircle/);

    // Check main heading
    await expect(
      page.getByRole('heading', { level: 1 })
    ).toBeVisible();

    // Check navigation
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('should have working navigation links', async ({ page }) => {
    await page.goto('/');

    // Check login link
    const loginLink = page.getByRole('link', { name: /로그인/ });
    await expect(loginLink).toBeVisible();

    // Check explore circles link
    const exploreLink = page.getByRole('link', { name: /둘러보기/ });
    if (await exploreLink.isVisible()) {
      await exploreLink.click();
      await expect(page).toHaveURL(/\/circles/);
    }
  });

  test('should be responsive', async ({ page }) => {
    await page.goto('/');

    // Desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.getByRole('navigation')).toBeVisible();

    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Mobile menu should be visible (hamburger icon)
    const mobileMenuButton = page.getByRole('button', { name: /메뉴/ });
    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click();
      await expect(page.getByRole('navigation')).toBeVisible();
    }
  });

  test('should have meta tags for SEO', async ({ page }) => {
    await page.goto('/');

    // Check meta description
    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute('content', /.+/);

    // Check Open Graph tags
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute('content', /.+/);
  });
});

test.describe('Accessibility', () => {
  test('should have no major accessibility violations', async ({ page }) => {
    await page.goto('/');

    // Check for proper heading hierarchy
    const h1 = await page.locator('h1').count();
    expect(h1).toBe(1);

    // Check for alt text on images
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');

      // Images should have alt text or role="presentation"
      expect(alt !== null || role === 'presentation').toBe(true);
    }

    // Check for form labels
    const inputs = page.locator('input:not([type="hidden"])');
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledby = await input.getAttribute('aria-labelledby');

      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        const hasLabel = await label.count() > 0 || ariaLabel || ariaLabelledby;
        expect(hasLabel).toBe(true);
      }
    }
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/');

    // Tab through the page
    await page.keyboard.press('Tab');

    // First focusable element should be focused
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Continue tabbing and ensure focus is visible
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');
      const isVisible = await focused.isVisible().catch(() => false);

      if (isVisible) {
        await expect(focused).toBeVisible();
      }
    }
  });
});

test.describe('Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('should have optimized images', async ({ page }) => {
    await page.goto('/');

    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const src = await img.getAttribute('src');

      if (src && !src.startsWith('data:')) {
        // Check for lazy loading
        const loading = await img.getAttribute('loading');
        const isAboveFold = await img.isVisible();

        // Images below fold should have lazy loading
        if (!isAboveFold) {
          expect(loading).toBe('lazy');
        }
      }
    }
  });
});
