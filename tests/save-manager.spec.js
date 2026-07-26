const { test, expect } = require('@playwright/test');
const { freshApp, seedManagerSeason } = require('./helpers');

// Regression coverage: clicking a save card's body used to do nothing (only
// a tiny unlabeled icon actually switched saves) -- fixed by making the
// whole non-active card clickable via data-action="switch-save".
test('clicking a save card body switches saves and isolates season data', async ({ page }) => {
  await freshApp(page);
  await seedManagerSeason(page, { season: { club: 'Riverside United' } });

  await page.click('#manager-mini');
  const activeId = await page.evaluate(() => appSettings.activeManagerSaveId);
  await page.click(`[data-action="rename-save"][data-id="${activeId}"]`);
  await page.fill('.save-card-name-input', 'Career Alpha');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);

  await page.fill('#save-manager-new-name', 'Career Beta');
  await page.click('#save-manager-create-btn'); // auto-switches to the new save, closes the modal
  await page.waitForTimeout(200);
  await seedManagerSeason(page, { season: { club: 'Ashfield Town' } });

  await page.click('#manager-mini');
  await page.click('.save-card:has-text("Career Alpha") .save-card-main');
  await page.waitForTimeout(200);

  const seasons = await page.evaluate(() => state.seasons.map(s => s.club));
  expect(await page.evaluate(() => state.name)).toBe('Career Alpha');
  expect(seasons).toEqual(['Riverside United']);
});

test('deleting the last remaining save is blocked with a toast, no confirm dialog', async ({ page }) => {
  await freshApp(page);
  await page.click('#manager-mini');
  const onlyId = await page.evaluate(() => loadSaves('manager')[0].id);
  await page.click(`[data-action="delete-save"][data-id="${onlyId}"]`);
  await expect(page.locator('.toast')).toContainText('at least one save');
  expect(await page.evaluate(() => document.getElementById('confirm-modal').hidden)).toBe(true);
  expect(await page.evaluate(() => loadSaves('manager').length)).toBe(1);
});

test('creating a save auto-switches to it with an empty season list', async ({ page }) => {
  await freshApp(page);
  await seedManagerSeason(page);
  await page.click('#manager-mini');
  await page.fill('#save-manager-new-name', 'Fresh Career');
  await page.click('#save-manager-create-btn');
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => state.seasons.length)).toBe(0);
  expect(await page.evaluate(() => state.name)).toBe('Fresh Career');
});
