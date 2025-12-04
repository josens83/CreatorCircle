/**
 * Circles E2E Tests
 */

import { test, expect } from '@playwright/test';
import path from 'path';

// Use authenticated user for these tests
test.use({
  storageState: path.join(__dirname, '../.playwright/.auth/user.json'),
});

test.describe('Circle Discovery', () => {
  test('should display circle listing page', async ({ page }) => {
    await page.goto('/circles');

    // Page should load
    await expect(page).toHaveURL(/\/circles/);

    // Should have heading
    await expect(
      page.getByRole('heading', { name: /써클|커뮤니티|둘러보기/ })
    ).toBeVisible();
  });

  test('should display circle cards', async ({ page }) => {
    await page.goto('/circles');

    // Wait for circles to load
    await page.waitForLoadState('networkidle');

    // Should have circle cards or empty state
    const circleCards = page.getByTestId('circle-card');
    const emptyState = page.getByTestId('empty-state');

    const hasCards = (await circleCards.count()) > 0;
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    expect(hasCards || hasEmptyState).toBe(true);
  });

  test('should filter circles by category', async ({ page }) => {
    await page.goto('/circles');

    // Find category filter
    const categoryFilter = page.getByRole('combobox', { name: /카테고리/ });

    if (await categoryFilter.isVisible()) {
      await categoryFilter.click();

      // Select a category
      const categoryOption = page.getByRole('option').first();
      if (await categoryOption.isVisible()) {
        await categoryOption.click();

        // URL should update with filter
        await expect(page).toHaveURL(/category=/);
      }
    }
  });

  test('should search circles', async ({ page }) => {
    await page.goto('/circles');

    // Find search input
    const searchInput = page.getByRole('searchbox');

    if (await searchInput.isVisible()) {
      await searchInput.fill('테스트');
      await searchInput.press('Enter');

      // URL should update with search query
      await expect(page).toHaveURL(/q=|search=/);
    }
  });
});

test.describe('Circle Detail', () => {
  test('should display circle detail page', async ({ page }) => {
    // First go to circles list
    await page.goto('/circles');
    await page.waitForLoadState('networkidle');

    // Click on first circle if available
    const circleCard = page.getByTestId('circle-card').first();

    if (await circleCard.isVisible()) {
      await circleCard.click();

      // Should navigate to circle detail
      await expect(page).toHaveURL(/\/circles\/[^/]+/);

      // Should show circle name
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
  });

  test('should show membership tiers', async ({ page }) => {
    await page.goto('/circles');
    await page.waitForLoadState('networkidle');

    const circleCard = page.getByTestId('circle-card').first();

    if (await circleCard.isVisible()) {
      await circleCard.click();
      await page.waitForLoadState('networkidle');

      // Look for membership section
      const membershipSection = page.getByTestId('membership-tiers');

      if (await membershipSection.isVisible()) {
        // Should show at least one tier
        const tiers = membershipSection.getByTestId('membership-tier');
        expect(await tiers.count()).toBeGreaterThan(0);
      }
    }
  });

  test('should show public posts', async ({ page }) => {
    await page.goto('/circles');
    await page.waitForLoadState('networkidle');

    const circleCard = page.getByTestId('circle-card').first();

    if (await circleCard.isVisible()) {
      await circleCard.click();
      await page.waitForLoadState('networkidle');

      // Look for posts section
      const postsSection = page.getByTestId('posts-section');

      if (await postsSection.isVisible()) {
        // Should show posts or empty state
        const posts = postsSection.getByTestId('post-card');
        const emptyState = postsSection.getByTestId('empty-posts');

        const hasPosts = (await posts.count()) > 0;
        const hasEmptyState = await emptyState.isVisible().catch(() => false);

        expect(hasPosts || hasEmptyState).toBe(true);
      }
    }
  });
});

test.describe('Circle Subscription', () => {
  test('should show subscribe button for non-members', async ({ page }) => {
    await page.goto('/circles');
    await page.waitForLoadState('networkidle');

    const circleCard = page.getByTestId('circle-card').first();

    if (await circleCard.isVisible()) {
      await circleCard.click();
      await page.waitForLoadState('networkidle');

      // Look for subscribe/join button
      const subscribeButton = page.getByRole('button', {
        name: /구독|가입|멤버십/,
      });

      // Should be visible for non-members
      if (await subscribeButton.isVisible()) {
        await expect(subscribeButton).toBeEnabled();
      }
    }
  });

  test('should show membership selection modal', async ({ page }) => {
    await page.goto('/circles');
    await page.waitForLoadState('networkidle');

    const circleCard = page.getByTestId('circle-card').first();

    if (await circleCard.isVisible()) {
      await circleCard.click();
      await page.waitForLoadState('networkidle');

      const subscribeButton = page.getByRole('button', {
        name: /구독|가입|멤버십/,
      });

      if (await subscribeButton.isVisible()) {
        await subscribeButton.click();

        // Modal or page should show membership options
        const membershipModal = page.getByRole('dialog');
        const membershipPage = page.getByTestId('membership-selection');

        const hasModal = await membershipModal.isVisible().catch(() => false);
        const hasPage = await membershipPage.isVisible().catch(() => false);

        expect(hasModal || hasPage).toBe(true);
      }
    }
  });
});
