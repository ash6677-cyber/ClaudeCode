const { test, expect } = require('@playwright/test');
const { freshApp, seedManagerSeason } = require('./helpers');

test('generating a transfer code and importing it round-trips the save data', async ({ page }) => {
  await freshApp(page);
  await seedManagerSeason(page, { season: { seasonLabel: '2025/26', club: 'Riverside United' } });
  await page.evaluate(() => { state.manager.name = 'Alex Sterling'; saveState(); switchTab('settings'); });

  await page.click('[data-action="generate-transfer-code"]');
  const code = await page.inputValue('#transfer-code-output');
  expect(code.startsWith('FCTC1:')).toBe(true);
  await expect(page.locator('#transfer-code-out-row')).toBeVisible();

  // Simulate "another device": wipe this save's data, then import the code.
  await page.evaluate(() => {
    state.manager = emptyManagerProfile();
    state.seasons = [];
    saveState();
  });
  await page.fill('#transfer-code-input', code);
  await page.click('[data-action="import-transfer-code"]');
  await page.waitForTimeout(200);

  const restored = await page.evaluate(() => ({ name: state.manager.name, seasonLabel: state.seasons[0] && state.seasons[0].seasonLabel, club: state.seasons[0] && state.seasons[0].club }));
  expect(restored.name).toBe('Alex Sterling');
  expect(restored.seasonLabel).toBe('2025/26');
  expect(restored.club).toBe('Riverside United');
  await expect(page.locator('.toast').last()).toContainText('imported');
});

test('importing garbage text as a transfer code fails cleanly with a toast, no crash', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await freshApp(page);
  await page.evaluate(() => switchTab('settings'));

  await page.fill('#transfer-code-input', 'not a real transfer code');
  await page.click('[data-action="import-transfer-code"]');
  await page.waitForTimeout(200);

  expect(errors).toEqual([]);
  await expect(page.locator('.toast')).toContainText('invalid or corrupted transfer code');
});

test('clicking Import Transfer Code with an empty box prompts for a code instead of importing', async ({ page }) => {
  await freshApp(page);
  await page.evaluate(() => switchTab('settings'));
  await page.click('[data-action="import-transfer-code"]');
  await page.waitForTimeout(150);
  await expect(page.locator('.toast')).toContainText('Paste a transfer code first');
});
