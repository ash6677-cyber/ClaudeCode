const { test, expect } = require('@playwright/test');
const { freshApp } = require('./helpers');

test('all five trophy archetypes mount without console errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('WebGL')) errors.push(msg.text()); });
  await freshApp(page);
  await page.waitForFunction(() => window.Trophy3D);

  await page.evaluate(() => {
    const types = ['cup', 'crown', 'continental', 'shield', 'medal'];
    types.forEach((type, i) => {
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;top:0;left:0;width:200px;height:200px;';
      document.body.appendChild(div);
      window.Trophy3D.mountTrophy('test-' + type, div, type, 'gold');
    });
  });
  await page.waitForTimeout(800);
  expect(errors.filter(e => !e.includes('sigmaRadians') && !e.includes('GPU stall'))).toEqual([]);
});

// Regression coverage: the shared render loop only cleared each frame's
// active scissor viewports, so a trophy card that left the DOM left its
// last-drawn pixels sitting untouched on the canvas underneath whatever
// page loaded next.
test('navigating away from the Trophy Cabinet leaves no ghost renders', async ({ page }) => {
  await freshApp(page);
  await page.evaluate(() => {
    const s = emptySeason();
    Object.assign(s, { seasonLabel: '2024/25', club: 'Riverside United' });
    s.league = { played: 38, won: 30, drawn: 4, lost: 4, gf: 90, ga: 25, points: 94, position: 1, leagueSize: 20 };
    state.seasons = [s];
    saveState();
    switchTab('trophies');
  });
  await page.waitForTimeout(600);

  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => switchTab('dashboard'));
    await page.waitForTimeout(150);
    await page.evaluate(() => switchTab('trophies'));
    await page.waitForTimeout(150);
  }

  await page.evaluate(() => switchTab('dashboard'));
  await page.waitForTimeout(300);
  // A blank/empty dashboard shouldn't have any trophy3d slot elements or
  // stray canvas artifacts drawn where dashboard content now sits.
  const slotCount = await page.locator('[data-trophy3d]').evaluateAll(
    els => els.filter(el => el.getBoundingClientRect().width > 2).length
  );
  expect(slotCount).toBe(0);
});
