const { test, expect } = require('@playwright/test');
const { freshApp, seedManagerSeason, seedPlayerSeason, switchToPlayerMode } = require('./helpers');

test('adding a match through the season form shows a live result badge and a form-guide chip on the card', async ({ page }) => {
  await freshApp(page);
  await seedManagerSeason(page, {});
  await page.evaluate(() => switchTab('seasons'));
  await page.click('.season-card [data-action="edit-season"]');
  await page.waitForTimeout(150);
  await page.evaluate(() => document.querySelectorAll('#season-modal details').forEach(d => d.open = true));

  await page.click('[data-action="add-row"][data-repeat="matches"]');
  await page.fill('[data-repeat="matches"][data-field="opponent"]', 'Rival FC');
  await page.fill('[data-repeat="matches"][data-field="gf"]', '3');
  await page.fill('[data-repeat="matches"][data-field="ga"]', '1');

  // The badge updates in place from gf/ga without a full re-render (which
  // would otherwise steal focus out of the input mid-type).
  await expect(page.locator('.match-result-badge')).toHaveText('W');
  await expect(page.locator('.match-result-badge')).toHaveClass(/match-result-w/);

  await page.evaluate(() => document.querySelector('#season-form').requestSubmit());
  await page.waitForTimeout(150);

  await expect(page.locator('.season-card-form .form-chip')).toHaveCount(1);
  await expect(page.locator('.season-card-form .form-chip').first()).toHaveText('W');
});

test('player mode match log captures personal goals/assists/rating alongside the result', async ({ page }) => {
  await freshApp(page);
  await switchToPlayerMode(page);
  await seedPlayerSeason(page, {});
  await page.evaluate(() => switchTab('p-seasons'));
  await page.click('.season-card [data-action="edit-player-season"]');
  await page.waitForTimeout(150);
  await page.evaluate(() => document.querySelectorAll('#season-modal details').forEach(d => d.open = true));

  await page.click('[data-action="add-row"][data-repeat="pmatches"]');
  await page.fill('[data-repeat="pmatches"][data-field="opponent"]', 'Rival FC');
  await page.fill('[data-repeat="pmatches"][data-field="gf"]', '1');
  await page.fill('[data-repeat="pmatches"][data-field="ga"]', '1');
  await page.fill('[data-repeat="pmatches"][data-field="goals"]', '1');
  await page.fill('[data-repeat="pmatches"][data-field="rating"]', '7.4');

  await expect(page.locator('.match-result-badge')).toHaveText('D');

  await page.evaluate(() => document.querySelector('#player-season-form').requestSubmit());
  await page.waitForTimeout(150);

  const saved = await page.evaluate(() => pState.seasons[0].matches[0]);
  expect(saved.opponent).toBe('Rival FC');
  expect(saved.goals).toBe('1');
  expect(saved.rating).toBe('7.4');
});

test('importing a save exported before match logging existed does not crash', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await freshApp(page);

  await page.evaluate(() => {
    return new Promise(resolve => {
      const oldFormatJson = JSON.stringify({
        manager: { name: 'Old Save Manager' },
        seasons: [{ id: 's1', seasonLabel: '2023/24', club: 'Legacy FC', league: { played: 10, won: 5, drawn: 3, lost: 2, gf: 20, ga: 10, points: 18, position: 4, leagueSize: 20 } }]
      });
      const file = new File([oldFormatJson], 'old.json', { type: 'application/json' });
      importJSON(file);
      setTimeout(resolve, 300);
    });
  });

  expect(errors).toEqual([]);
  const hasMatchesArray = await page.evaluate(() => Array.isArray(state.seasons[0].matches));
  expect(hasMatchesArray).toBe(true);
  await page.evaluate(() => switchTab('seasons'));
  await expect(page.locator('#seasons-list .season-card')).toBeVisible();
});
