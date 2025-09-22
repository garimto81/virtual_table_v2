// @ts-check
const { test, expect } = require('@playwright/test');

test('has title', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Playwright/);
});

test('get started link', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // Click the get started link.
  await page.getByRole('link', { name: 'Get started' }).click();

  // Expects page to have a heading with the name of Installation.
  await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
});

test('simple browser automation', async ({ page }) => {
  await page.goto('https://example.com');

  // Take a screenshot
  await page.screenshot({ path: 'example-page.png' });

  // Check page title
  await expect(page).toHaveTitle('Example Domain');

  // Check if certain text exists
  await expect(page.locator('h1')).toContainText('Example Domain');
});