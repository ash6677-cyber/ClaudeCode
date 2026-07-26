const path = require('path');
const { test, expect } = require('@playwright/test');
const { freshApp } = require('./helpers');

test.setTimeout(60000);

async function openSeasonForm(page) {
  await freshApp(page);
  await page.evaluate(() => openSeasonModal(null));
  await page.waitForTimeout(150);
}

test('the first scan shows the tutorial instead of jumping straight to the photo picker', async ({ page }) => {
  await openSeasonForm(page);

  await page.click('[data-action="scan-photo"]');
  await expect(page.locator('#ocr-tutorial-modal')).toBeVisible();
  await expect(page.locator('#ocr-tutorial-modal')).toContainText('never uploaded anywhere');
  await expect(page.locator('.ocr-tutorial-steps li')).toHaveCount(3);
});

test('continuing from the tutorial opens the picker and does not show it again', async ({ page }) => {
  await openSeasonForm(page);
  await page.click('[data-action="scan-photo"]');
  await expect(page.locator('#ocr-tutorial-modal')).toBeVisible();

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('[data-action="ocr-tutorial-continue"]'),
  ]);
  await expect(page.locator('#ocr-tutorial-modal')).toBeHidden();
  expect(await page.evaluate(() => appSettings.hasSeenOcrTutorial)).toBe(true);
  await chooser.setFiles(path.join(__dirname, 'fixtures', 'manager-league-stats.png'));
  await expect(page.locator('#ocr-review-modal')).toBeVisible({ timeout: 30000 });
  await page.click('[data-action="ocr-review-cancel"]');

  // Second scan skips the tutorial entirely.
  const [chooser2] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('[data-action="scan-photo"]'),
  ]);
  expect(chooser2).toBeTruthy();
  await expect(page.locator('#ocr-tutorial-modal')).toBeHidden();
});

test('dismissing the tutorial without continuing still marks it as seen', async ({ page }) => {
  await openSeasonForm(page);
  await page.click('[data-action="scan-photo"]');
  await expect(page.locator('#ocr-tutorial-modal')).toBeVisible();

  await page.click('#ocr-tutorial-close');
  await expect(page.locator('#ocr-tutorial-modal')).toBeHidden();
  expect(await page.evaluate(() => appSettings.hasSeenOcrTutorial)).toBe(true);

  // No file picker opened, and the next scan goes straight to one.
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('[data-action="scan-photo"]'),
  ]);
  expect(chooser).toBeTruthy();
});

test('the tutorial preference survives a reload', async ({ page }) => {
  await openSeasonForm(page);
  await page.click('[data-action="scan-photo"]');
  await page.click('#ocr-tutorial-close');

  await page.reload();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => appSettings.hasSeenOcrTutorial)).toBe(true);
});

test('"How does this work?" reopens the tutorial above the review modal', async ({ page }) => {
  await openSeasonForm(page);
  await page.evaluate(() => { appSettings.hasSeenOcrTutorial = true; saveAppSettings(); });

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('[data-action="scan-photo"]'),
  ]);
  await chooser.setFiles(path.join(__dirname, 'fixtures', 'manager-league-stats.png'));
  await expect(page.locator('#ocr-review-modal')).toBeVisible({ timeout: 30000 });

  await page.click('[data-action="ocr-show-tutorial"]');
  await expect(page.locator('#ocr-tutorial-modal')).toBeVisible();

  // It must actually be on top of the review modal, not behind it.
  const box = await page.locator('[data-action="ocr-tutorial-continue"]').boundingBox();
  const onTop = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return !!(el && el.closest('#ocr-tutorial-modal'));
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  expect(onTop).toBe(true);
});
