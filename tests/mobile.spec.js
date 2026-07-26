const { test, expect } = require('@playwright/test');
const { freshApp } = require('./helpers');

test.use({ viewport: { width: 390, height: 844 } });

test('mobile layout toggle enables the bottom tab bar and navigation works', async ({ page }) => {
  await freshApp(page);
  await page.evaluate(() => switchTab('settings'));
  await page.click('.layout-toggle button[data-layout="mobile"]');
  await page.waitForTimeout(200);
  expect(await page.getAttribute('html', 'data-layout')).toBe('mobile');

  await page.click('#mobile-tabbar [data-tab="seasons"]');
  await page.waitForTimeout(200);
  expect(await page.$eval('#page-title', el => el.textContent)).toBe('Seasons');

  await page.click('#mode-switch-mobile .mode-switch-btn[data-mode="player"]');
  await page.waitForTimeout(200);
  expect(await page.getAttribute('html', 'data-app-mode')).toBe('player');
});
