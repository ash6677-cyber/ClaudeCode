const path = require('path');
const { test, expect } = require('@playwright/test');
const { freshApp, switchToPlayerMode } = require('./helpers');

test.setTimeout(60000);

test('scanning a manager league-stats photo pre-fills the matching fields after review', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await freshApp(page);
  await page.waitForFunction(() => window.Tesseract);

  await page.click('.btn:has-text("Add Season"), .btn:has-text("Add First Season")');
  await page.waitForTimeout(150);

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('[data-action="scan-photo"]'),
  ]);
  await chooser.setFiles(path.join(__dirname, 'fixtures', 'manager-league-stats.png'));

  await expect(page.locator('#ocr-review-modal')).toBeVisible({ timeout: 30000 });
  const rowCount = await page.locator('.ocr-review-row').count();
  expect(rowCount).toBeGreaterThanOrEqual(6);

  await page.click('[data-action="ocr-review-apply"]');
  await page.waitForTimeout(200);
  await expect(page.locator('#ocr-review-modal')).toBeHidden();

  await page.evaluate(() => document.querySelectorAll('#season-modal details').forEach(d => d.open = true));
  expect(await page.inputValue('#f-league-played')).toBe('38');
  expect(await page.inputValue('#f-league-won')).toBe('25');
  expect(await page.inputValue('#f-league-drawn')).toBe('8');
  expect(await page.inputValue('#f-league-lost')).toBe('5');
  expect(await page.inputValue('#f-league-gf')).toBe('90');
  expect(await page.inputValue('#f-league-ga')).toBe('30');
  expect(await page.inputValue('#f-league-points')).toBe('83');
  expect(await page.inputValue('#f-league-position')).toBe('2');
  expect(await page.isChecked('#f-league-promoted')).toBe(true);

  expect(errors).toEqual([]);
});

test('scanning a player stats photo pre-fills player fields', async ({ page }) => {
  await freshApp(page);
  await switchToPlayerMode(page);
  await page.waitForFunction(() => window.Tesseract);

  await page.click('.btn:has-text("Add Season"), .btn:has-text("Add First Season")');
  await page.waitForTimeout(150);

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('[data-action="scan-photo"]'),
  ]);
  await chooser.setFiles(path.join(__dirname, 'fixtures', 'player-season-stats.png'));

  await expect(page.locator('#ocr-review-modal')).toBeVisible({ timeout: 30000 });
  await page.click('[data-action="ocr-review-apply"]');
  await page.waitForTimeout(200);

  await page.evaluate(() => document.querySelectorAll('#season-modal details').forEach(d => d.open = true));
  expect(await page.inputValue('#pf-atk-goals')).toBe('22');
  expect(await page.inputValue('#pf-atk-assists')).toBe('10');
  expect(await page.inputValue('#pf-app-played')).toBe('34');
  expect(await page.inputValue('#pf-app-minutes')).toBe('2890');
  expect(await page.inputValue('#pf-form-avgRating')).toBe('7.6');
});

test('unchecking a row and editing a value before Apply is respected', async ({ page }) => {
  await freshApp(page);
  await page.waitForFunction(() => window.Tesseract);
  await page.click('.btn:has-text("Add Season"), .btn:has-text("Add First Season")');
  await page.waitForTimeout(150);

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('[data-action="scan-photo"]'),
  ]);
  await chooser.setFiles(path.join(__dirname, 'fixtures', 'manager-league-stats.png'));
  await expect(page.locator('#ocr-review-modal')).toBeVisible({ timeout: 30000 });

  // Find the row for "Won" and edit its value, and uncheck the "Lost" row.
  const rows = page.locator('.ocr-review-row');
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const label = (await rows.nth(i).locator('.checkbox-field span').textContent()).trim();
    if (label === 'Won') await rows.nth(i).locator('input.input').fill('99');
    if (label === 'Lost') await rows.nth(i).locator('input[type="checkbox"]').first().uncheck();
  }

  await page.click('[data-action="ocr-review-apply"]');
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelectorAll('#season-modal details').forEach(d => d.open = true));
  expect(await page.inputValue('#f-league-won')).toBe('99');
  expect(await page.inputValue('#f-league-lost')).toBe('0'); // never applied, stays at emptySeason()'s default of 0
});

test('cancelling the review modal applies nothing', async ({ page }) => {
  await freshApp(page);
  await page.waitForFunction(() => window.Tesseract);
  await page.click('.btn:has-text("Add Season"), .btn:has-text("Add First Season")');
  await page.waitForTimeout(150);

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('[data-action="scan-photo"]'),
  ]);
  await chooser.setFiles(path.join(__dirname, 'fixtures', 'manager-league-stats.png'));
  await expect(page.locator('#ocr-review-modal')).toBeVisible({ timeout: 30000 });

  await page.click('[data-action="ocr-review-cancel"]');
  await expect(page.locator('#ocr-review-modal')).toBeHidden();
  await page.evaluate(() => document.querySelectorAll('#season-modal details').forEach(d => d.open = true));
  expect(await page.inputValue('#f-league-played')).toBe('0');
});

test('a photo with no recognizable stats shows a toast and opens no modal', async ({ page }) => {
  await freshApp(page);
  await page.waitForFunction(() => window.Tesseract);
  await page.click('.btn:has-text("Add Season"), .btn:has-text("Add First Season")');
  await page.waitForTimeout(150);

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('[data-action="scan-photo"]'),
  ]);
  await chooser.setFiles(path.join(__dirname, 'fixtures', 'gibberish.png'));

  await expect(page.locator('.toast').last()).toContainText('No recognizable stats', { timeout: 30000 });
  await expect(page.locator('#ocr-review-modal')).toBeHidden();
});
