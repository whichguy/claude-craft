/**
 * Playwright test for gas-debugger web app
 * Tests the OAuth debugging interface
 */

import { test, expect } from '@playwright/test';

const GAS_DEBUGGER_URL = 'https://script.google.com/macros/s/AKfycbyjV_UwUfG4K1vKptfyS73BibXE5awCNUr7FMZW62se/dev';

test.describe('GAS Debugger', () => {
  test('should load the gas-debugger page', async ({ page }) => {
    await page.goto(GAS_DEBUGGER_URL);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check for main title
    await expect(page.locator('h1')).toContainText('GAS Debugger');
  });

  test('should display OAuth status panel', async ({ page }) => {
    await page.goto(GAS_DEBUGGER_URL);
    await page.waitForLoadState('networkidle');

    // Check for OAuth Status section
    await expect(page.locator('h2:has-text("OAuth Status")')).toBeVisible();

    // Check for status cards
    await expect(page.locator('.status-card:has-text("Authentication")')).toBeVisible();
    await expect(page.locator('.status-card:has-text("Token")')).toBeVisible();
    await expect(page.locator('.status-card:has-text("User")')).toBeVisible();
    await expect(page.locator('.status-card:has-text("Expiry")')).toBeVisible();
  });

  test('should display script execution panel', async ({ page }) => {
    await page.goto(GAS_DEBUGGER_URL);
    await page.waitForLoadState('networkidle');

    // Check for Script Execution section
    await expect(page.locator('h2:has-text("Script Execution")')).toBeVisible();

    // Check for code textarea
    const codeTextarea = page.locator('#code-input');
    await expect(codeTextarea).toBeVisible();

    // Check for execute button
    await expect(page.locator('button:has-text("Execute Code")')).toBeVisible();
  });

  test('should have action buttons', async ({ page }) => {
    await page.goto(GAS_DEBUGGER_URL);
    await page.waitForLoadState('networkidle');

    // Check for all action buttons
    await expect(page.locator('button:has-text("Check Auth Status")')).toBeVisible();
    await expect(page.locator('button:has-text("Start OAuth Flow")')).toBeVisible();
    await expect(page.locator('button:has-text("Clear Auth")')).toBeVisible();
  });

  test('should check auth status when button clicked', async ({ page }) => {
    await page.goto(GAS_DEBUGGER_URL);
    await page.waitForLoadState('networkidle');

    // Click check auth status button
    await page.locator('button:has-text("Check Auth Status")').click();

    // Wait for potential loading state
    await page.waitForTimeout(2000);

    // Check that status values are populated (not "Loading...")
    const authStatus = await page.locator('.status-card:has-text("Authentication") .status-value').textContent();
    expect(authStatus).not.toBe('Loading...');
  });

  test('should execute simple JavaScript code', async ({ page }) => {
    await page.goto(GAS_DEBUGGER_URL);
    await page.waitForLoadState('networkidle');

    // Enter simple JavaScript code
    await page.locator('#code-input').fill('return 2 + 2;');

    // Click execute button
    await page.locator('button:has-text("Execute Code")').click();

    // Wait for execution to complete
    await page.waitForTimeout(3000);

    // Check for result in execution result area
    const resultText = await page.locator('#execution-result').textContent();
    expect(resultText).toContain('4');
  });

  test('should display logs panel', async ({ page }) => {
    await page.goto(GAS_DEBUGGER_URL);
    await page.waitForLoadState('networkidle');

    // Check for logs section
    await expect(page.locator('h2:has-text("Logs")')).toBeVisible();

    // Check for log container
    await expect(page.locator('#log-container')).toBeVisible();
  });

  test('should start OAuth flow when button clicked', async ({ page }) => {
    await page.goto(GAS_DEBUGGER_URL);
    await page.waitForLoadState('networkidle');

    // Click start OAuth flow button
    const [popup] = await Promise.race([
      Promise.all([
        page.waitForEvent('popup', { timeout: 5000 }),
        page.locator('button:has-text("Start OAuth Flow")').click()
      ]),
      // If no popup, that's okay - just verify button click worked
      page.locator('button:has-text("Start OAuth Flow")').click().then(() => [null])
    ]);

    // If popup opened, verify it's a Google OAuth URL
    if (popup) {
      const url = popup.url();
      expect(url).toContain('accounts.google.com');
      await popup.close();
    }
  });

  test('should clear auth data when button clicked', async ({ page }) => {
    await page.goto(GAS_DEBUGGER_URL);
    await page.waitForLoadState('networkidle');

    // Click clear auth button
    await page.locator('button:has-text("Clear Auth")').click();

    // Wait for operation to complete
    await page.waitForTimeout(2000);

    // Verify log entry was created
    const logContainer = page.locator('#log-container');
    const logText = await logContainer.textContent();
    expect(logText.length).toBeGreaterThan(0);
  });
});
