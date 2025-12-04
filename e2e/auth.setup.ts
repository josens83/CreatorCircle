/**
 * Authentication Setup for E2E Tests
 * Creates authenticated state for test users
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../.playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');

  // Check if already logged in (redirect to home)
  const currentUrl = page.url();
  if (!currentUrl.includes('/login')) {
    // Already authenticated, save state and return
    await page.context().storageState({ path: authFile });
    return;
  }

  // Fill in login credentials (using test account)
  await page.getByLabel('이메일').fill('test@example.com');
  await page.getByLabel('비밀번호').fill('TestPassword123!');

  // Submit login form
  await page.getByRole('button', { name: '로그인' }).click();

  // Wait for successful login (redirect to dashboard or home)
  await expect(page).not.toHaveURL(/\/login/);

  // Verify user is logged in
  await expect(page.getByTestId('user-menu')).toBeVisible();

  // Save authentication state
  await page.context().storageState({ path: authFile });
});

// Creator authentication setup
const creatorAuthFile = path.join(__dirname, '../.playwright/.auth/creator.json');

setup('authenticate as creator', async ({ page }) => {
  await page.goto('/login');

  const currentUrl = page.url();
  if (!currentUrl.includes('/login')) {
    await page.context().storageState({ path: creatorAuthFile });
    return;
  }

  // Login as creator account
  await page.getByLabel('이메일').fill('creator@example.com');
  await page.getByLabel('비밀번호').fill('CreatorPassword123!');

  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page).not.toHaveURL(/\/login/);

  await page.context().storageState({ path: creatorAuthFile });
});
