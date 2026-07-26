const { test, expect } = require('@playwright/test');
const { freshApp } = require('./helpers');

async function withClub(page, club) {
  await page.evaluate((c) => {
    const s = emptySeason();
    Object.assign(s, { seasonLabel: '2025/26', club: c });
    s.league = { played: 38, won: 24, drawn: 8, lost: 6, gf: 78, ga: 34, points: 80, position: 2, leagueSize: 20 };
    state.seasons = [s];
    saveState();
    applyTheme();
  }, club);
  await page.waitForTimeout(150);
}

test('money scales its unit to the amount instead of always saying M', async ({ page }) => {
  await freshApp(page);
  const out = await page.evaluate(() =>
    [0, 0.0004, 0.35, 0.4, 1, 40, 1200, -0.35].map(v => fmtM(v, '£')));
  expect(out).toEqual(['£0', '£400', '£350K', '£400K', '£1.0M', '£40.0M', '£1.20B', '-£350K']);
});

test('a sub-million transfer budget reads in K across the app', async ({ page }) => {
  await freshApp(page);
  await page.evaluate(() => {
    const s = emptySeason();
    Object.assign(s, { seasonLabel: '2025/26', club: 'Lower League FC' });
    s.league = { played: 38, won: 10, drawn: 10, lost: 18, gf: 30, ga: 50, points: 40, position: 18, leagueSize: 24 };
    s.transfersIn = [{ id: 'i1', name: 'Cheap Signing', position: 'ST', type: 'Permanent', fee: 0.25, club: 'Rival' }];
    state.seasons = [s];
    saveState();
    switchTab('transfers');
  });
  await page.waitForTimeout(300);
  const text = await page.textContent('#transfers-content');
  expect(text).toContain('£250K');
  expect(text).not.toContain('0.3M');
});

test('the header shows the club initials and name once a season exists', async ({ page }) => {
  await freshApp(page);
  await withClub(page, 'Riverside United');
  await expect(page.locator('.sidebar .brand-mark')).toHaveText('RU');
  await expect(page.locator('.brand-club')).toHaveText('Riverside United');
  expect(await page.getAttribute('html', 'data-club-themed')).toBe('true');
});

test('club colours are deterministic per club and differ between clubs', async ({ page }) => {
  await freshApp(page);
  const read = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--club-1').trim());

  await withClub(page, 'Riverside United');
  const a1 = await read();
  await withClub(page, 'Hartfield Athletic');
  const b1 = await read();
  await withClub(page, 'Riverside United');
  const a2 = await read();

  expect(a1).toBeTruthy();
  expect(a1).not.toBe(b1);
  expect(a2).toBe(a1); // same club always resolves to the same palette
});

// The reason club colours are solved rather than picked: at a fixed lightness,
// a large share of hues fail AA against one background or the other, which
// would leave some club names with unreadable headings.
test('every club colour clears AA contrast in both themes', async ({ page }) => {
  await freshApp(page);
  const res = await page.evaluate(() => {
    const parse = css => { const m = css.match(/hsl\((\d+) (\d+)% ([\d.]+)%/); return hslToRgb(+m[1], +m[2], +m[3]); };
    const white = relLuminance([255, 255, 255]);
    let inkFail = 0, plateFail = 0;
    ['dark', 'light'].forEach(mode => {
      appSettings.theme = mode;
      const bg = relLuminance(mode === 'light' ? [238, 241, 251] : [6, 8, 16]);
      for (let i = 0; i < 300; i++) {
        const t = clubTheme('Test Club ' + i);
        if (contrastRatio(relLuminance(parse(t.ink)), bg) < 4.5) inkFail++;
        if (contrastRatio(relLuminance(parse(t.c1)), white) < 4.5) plateFail++;
        if (contrastRatio(relLuminance(parse(t.c2)), white) < 4.5) plateFail++;
      }
    });
    return { inkFail, plateFail };
  });
  expect(res.inkFail).toBe(0);
  expect(res.plateFail).toBe(0);
});

test('club colours can be switched off in Settings', async ({ page }) => {
  await freshApp(page);
  await withClub(page, 'Riverside United');
  await page.evaluate(() => switchTab('settings'));
  await page.waitForTimeout(200);

  await page.click('.club-theme-toggle button[data-club-theme="off"]');
  await page.waitForTimeout(250);
  expect(await page.getAttribute('html', 'data-club-themed')).toBeNull();
  expect(await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--club-1').trim())).toBe('');

  await page.reload();
  await page.waitForTimeout(400);
  expect(await page.getAttribute('html', 'data-club-themed')).toBeNull(); // preference persists
});

test('initials skip generic club suffixes', async ({ page }) => {
  await freshApp(page);
  const out = await page.evaluate(() =>
    ['Riverside United', 'Hartfield Athletic', 'AFC Norvale', 'Ajax', 'Real Madrid CF']
      .map(n => clubTheme(n).initials));
  expect(out).toEqual(['RU', 'HA', 'NO', 'AJ', 'RM']);
});
