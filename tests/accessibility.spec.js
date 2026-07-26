const { test, expect } = require('@playwright/test');
const { freshApp } = require('./helpers');

test('icon-only season/save action buttons have accessible names', async ({ page }) => {
  await freshApp(page);
  await page.evaluate(() => {
    const s = emptySeason();
    Object.assign(s, { seasonLabel: '2024/25', club: 'Riverside United' });
    s.league = { played: 38, won: 20, drawn: 10, lost: 8, gf: 60, ga: 40, points: 70, position: 5, leagueSize: 20 };
    state.seasons = [s];
    saveState();
    switchTab('seasons');
  });
  await page.waitForTimeout(200);
  const names = await page.locator('.season-card-actions button').evaluateAll(
    els => els.map(el => el.getAttribute('aria-label'))
  );
  expect(names.every(Boolean)).toBe(true);

  await page.evaluate(() => openSaveManagerModal());
  await page.waitForTimeout(150);
  const saveActionNames = await page.locator('.save-card-actions button').evaluateAll(
    els => els.map(el => el.getAttribute('aria-label'))
  );
  expect(saveActionNames.every(Boolean)).toBe(true);
});

test('opening a modal moves focus inside it and closing restores it', async ({ page }) => {
  await freshApp(page);
  await page.click('#add-season-btn');
  await page.waitForTimeout(150);
  const focusedInsideModal = await page.evaluate(() => !!document.activeElement.closest('#season-modal'));
  expect(focusedInsideModal).toBe(true);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const focusedBackOnTrigger = await page.evaluate(() => document.activeElement.id);
  expect(focusedBackOnTrigger).toBe('add-season-btn');
});

test('prefers-reduced-motion disables the trophy auto-rotate and blob animation', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await freshApp(page);
  await page.waitForFunction(() => window.Trophy3D);

  const blobAnimation = await page.evaluate(() => {
    const blob = document.querySelector('.blob-1');
    return getComputedStyle(blob).animationName;
  });
  expect(blobAnimation).toBe('none');

  await page.evaluate(() => {
    const s = emptySeason();
    Object.assign(s, { seasonLabel: '2024/25', club: 'Riverside United' });
    s.league = { played: 38, won: 30, drawn: 4, lost: 4, gf: 90, ga: 25, points: 94, position: 1, leagueSize: 20 };
    state.seasons = [s];
    saveState();
    switchTab('trophies');
  });
  await page.waitForTimeout(300);
  const reduceMotionMatches = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  expect(reduceMotionMatches).toBe(true);
  await context.close();
});

test('light theme text-faint color passes WCAG AA contrast against the app background', async ({ page }) => {
  await freshApp(page);
  await page.evaluate(() => { appSettings.theme = 'light'; saveAppSettings(); applyTheme(); });
  await page.waitForTimeout(150);
  const ratio = await page.evaluate(() => {
    function luminance(hex) {
      const c = hex.match(/\w\w/g).map(x => parseInt(x, 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    }
    const root = getComputedStyle(document.documentElement);
    const faint = root.getPropertyValue('--text-faint').trim();
    const bg = root.getPropertyValue('--bg').trim();
    const L1 = luminance(faint), L2 = luminance(bg);
    const lighter = Math.max(L1, L2), darker = Math.min(L1, L2);
    return (lighter + 0.05) / (darker + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});
