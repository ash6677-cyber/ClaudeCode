const { test, expect } = require('@playwright/test');
const { freshApp } = require('./helpers');

// Regression coverage: League Played not matching Won+Drawn+Lost used to
// save silently, producing contradictory Matches Played / Win Rate numbers
// on the same stat grid.
test('blocks saving a season where Played does not equal Won+Drawn+Lost', async ({ page }) => {
  await freshApp(page);
  await page.click('.btn:has-text("Add Season"), .btn:has-text("Add First Season")');
  await page.fill('#f-seasonLabel', '2025/26');
  await page.fill('#f-club', 'Riverside United');
  await page.fill('#f-league-played', '38');
  await page.fill('#f-league-won', '30');
  await page.fill('#f-league-drawn', '5');
  await page.fill('#f-league-lost', '5'); // sums to 40, not 38
  await page.evaluate(() => document.querySelector('#season-form').requestSubmit());

  await expect(page.locator('.toast')).toContainText("doesn't match");
  expect(await page.evaluate(() => state.seasons.length)).toBe(0);
  expect(await page.evaluate(() => document.getElementById('f-league-played').classList.contains('field-error'))).toBe(true);

  // Fixing the numbers should allow it to save.
  await page.fill('#f-league-won', '28');
  await page.evaluate(() => document.querySelector('#season-form').requestSubmit());
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => state.seasons.length)).toBe(1);
});

// Regression coverage: Career Totals' "Best Season" section used to
// disappear entirely whenever the only season on record had a poor league
// position, because the scoring sentinel (-1) could beat a legitimately
// negative score.
test('Best Season still appears for a lone season with a poor league position', async ({ page }) => {
  await freshApp(page);
  await page.evaluate(() => {
    const s = emptySeason();
    Object.assign(s, { seasonLabel: '2024/25', club: 'Riverside United', divisionTier: 'Regional League' });
    s.league = { played: 20, won: 2, drawn: 3, lost: 15, gf: 15, ga: 60, points: 9, position: 150, leagueSize: 200 };
    state.seasons = [s];
    saveState();
    switchTab('totals');
  });
  await page.waitForTimeout(300);
  const titles = await page.locator('.section-title').allTextContents();
  expect(titles).toContain('Best Season');
});

test('duplicating a season pre-fills club/division and advances the label', async ({ page }) => {
  await freshApp(page);
  await page.evaluate(() => {
    const s = emptySeason();
    Object.assign(s, { seasonLabel: '2024/25', club: 'Riverside United', divisionTier: 'Premier League' });
    s.league = { played: 38, won: 20, drawn: 10, lost: 8, gf: 60, ga: 40, points: 70, position: 5, leagueSize: 20 };
    state.seasons = [s];
    saveState();
    switchTab('seasons');
  });
  await page.waitForTimeout(200);
  await page.click('[data-action="duplicate-season"]');
  await page.waitForTimeout(200);
  expect(await page.$eval('#season-modal-title', el => el.textContent)).toBe('Add Season');
  expect(await page.$eval('#f-seasonLabel', el => el.value)).toBe('2025/26');
  expect(await page.$eval('#f-club', el => el.value)).toBe('Riverside United');
  expect(await page.$eval('#f-league-played', el => el.value)).toBe('0');
});
