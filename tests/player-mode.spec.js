const { test, expect } = require('@playwright/test');
const { freshApp, seedPlayerSeason, switchToPlayerMode } = require('./helpers');

// Regression coverage: the add-row/remove-row/input/change handlers read
// playerSeasonDraft['pcompetitions'] instead of playerSeasonDraft.competitions
// (the actual field name), so "+ Add Competition" threw immediately and it
// was impossible to log any cup trophy in Player mode at all.
test('Player mode "+ Add Competition" adds a row and its trophy shows up on save', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await freshApp(page);
  await switchToPlayerMode(page);

  await page.click('.btn:has-text("Add Season"), .btn:has-text("Add First Season")');
  await page.fill('#pf-seasonLabel', '2025/26');
  await page.fill('#pf-club', 'Riverside United');
  await page.evaluate(() => document.querySelectorAll('#season-modal details').forEach(d => d.open = true));

  await page.click('[data-action="add-row"][data-repeat="pcompetitions"]');
  await page.fill('[data-repeat="pcompetitions"][data-field="name"]', 'FA Youth Cup');
  await page.selectOption('[data-repeat="pcompetitions"][data-field="result"]', 'Winner');
  await page.evaluate(() => document.querySelector('#player-season-form').requestSubmit());
  await page.waitForTimeout(200);

  expect(errors).toEqual([]);
  await page.evaluate(() => switchTab('p-honours'));
  await page.waitForTimeout(600);
  await expect(page.locator('#p-honours-content')).toContainText('FA Youth Cup');
});

test('International tab excludes seasons where calledUp is false', async ({ page }) => {
  await freshApp(page);
  await switchToPlayerMode(page);
  await page.evaluate(() => {
    const capped = emptyPlayerSeason();
    Object.assign(capped, { seasonLabel: '2023/24', club: 'Riverside United' });
    capped.international = { calledUp: true, team: 'England', caps: 5, goals: 2, tournament: '', tournamentResult: '' };
    const notCapped = emptyPlayerSeason();
    Object.assign(notCapped, { seasonLabel: '2024/25', club: 'Riverside United' });
    notCapped.international = { calledUp: false, team: '', caps: 0, goals: 0, tournament: '', tournamentResult: '' };
    pState.seasons = [capped, notCapped];
    savePlayerState();
    switchTab('p-international');
  });
  await page.waitForTimeout(300);
  const rows = await page.locator('#p-international-content table tbody tr').count();
  expect(rows).toBe(1);
  await expect(page.locator('#p-international-content')).toContainText('England');
});
