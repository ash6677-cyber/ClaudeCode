const { test, expect } = require('@playwright/test');
const { freshApp } = require('./helpers');

// Regression coverage: importing a season object missing its `league`
// sub-object crashed every subsequent render ("Cannot read properties of
// undefined (reading 'position')") and showed a contradictory
// "imported" + "import failed" toast pair.
test('importing an incomplete season does not crash and shows exactly one toast', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await freshApp(page);

  await page.evaluate(() => {
    return new Promise(resolve => {
      const badJson = JSON.stringify({ manager: { name: 'X' }, seasons: [{ id: 's1', club: 'Y', seasonLabel: '2025/26' }] });
      const file = new File([badJson], 'test.json', { type: 'application/json' });
      importJSON(file);
      setTimeout(resolve, 300);
    });
  });

  expect(errors).toEqual([]);
  expect(await page.evaluate(() => state.seasons[0] && !!state.seasons[0].league)).toBe(true);
  await expect(page.locator('.toast')).toHaveCount(1);
});

// Regression coverage: computeCareerTotals()'s finances.net used to be
// income - spend while the Transfers tab computed spend - income for a tile
// with the same "Net Spend" label -- exact negations of each other.
test('Net Spend agrees between the Transfers tab, Career Totals, and Dashboard', async ({ page }) => {
  await freshApp(page);
  await page.evaluate(() => {
    const s = emptySeason();
    Object.assign(s, { seasonLabel: '2025/26', club: 'Riverside United' });
    s.league = { played: 10, won: 5, drawn: 3, lost: 2, gf: 20, ga: 10, points: 18, position: 3, leagueSize: 20 };
    s.transfersIn = [{ id: 't1', name: 'Player A', position: 'ST', type: 'Permanent', fee: 80, club: 'Rival FC' }];
    s.transfersOut = [{ id: 't2', name: 'Player B', position: 'CB', type: 'Permanent', fee: 20, club: 'Other FC' }];
    state.seasons = [s];
    saveState();
  });

  const readNet = async (tabId, selector, label) => {
    await page.evaluate((t) => switchTab(t), tabId);
    await page.waitForTimeout(150);
    return page.evaluate(({ sel, lbl }) => {
      const tile = Array.from(document.querySelectorAll(sel)).find(t => t.textContent.includes(lbl));
      return tile ? tile.querySelector('.stat-value').textContent : null;
    }, { sel: selector, lbl: label });
  };

  const transfersNet = await readNet('transfers', '#transfers-content .stat-tile', 'Net Spend');
  const totalsNet = await readNet('totals', '#totals-content .stat-tile', 'Net Spend');
  const dashNet = await readNet('dashboard', '.stat-tile', 'Net Transfer Spend');

  expect(transfersNet).toBe('£60.0M');
  expect(totalsNet).toBe(transfersNet);
  expect(dashNet).toBe(transfersNet);
});
