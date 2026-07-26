const { test, expect } = require('@playwright/test');
const { freshApp } = require('./helpers');

test.use({ viewport: { width: 390, height: 844 } });

async function mobileLayout(page) {
  await freshApp(page);
  await page.evaluate(() => switchTab('settings'));
  await page.click('.layout-toggle button[data-layout="mobile"]');
  await page.waitForTimeout(200);
}

// The sheets animate in over 280ms. Measuring geometry before that settles
// races the animation, so wait on the animations themselves rather than
// guessing a timeout that holds only on an unloaded machine.
async function settled(page, selector) {
  await page.locator(selector).waitFor({ state: 'visible' });
  await page.locator(selector).evaluate(el =>
    Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished.catch(() => {})))
  );
}

// Regression coverage: the mobile sheet capped .modal at 92vh but left it
// overflow:visible, so a form taller than the cap spilled outside the modal
// box -- and since the overlay aligns the sheet to flex-end, that overflow
// couldn't be scrolled to in either element. Every long season form had its
// Save Season button stranded off-screen, making it impossible to save a
// season at all in mobile layout.
test('the Save Season button is on-screen and clickable in the mobile sheet', async ({ page }) => {
  await mobileLayout(page);
  await page.evaluate(() => openSeasonModal(null));
  await settled(page, '#season-modal .modal');
  await page.evaluate(() => document.querySelectorAll('#season-modal details').forEach(d => d.open = true));
  await page.waitForTimeout(150);

  const submit = page.locator('#season-form button[type="submit"]');
  await expect(submit).toBeInViewport();

  // Hit-test it: nothing may be painted on top of the button.
  const box = await submit.boundingBox();
  const hit = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return !!(el && el.closest('button[type="submit"]'));
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  expect(hit).toBe(true);
});

test('a trophy added on mobile saves to the season and shows in the cabinet', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await mobileLayout(page);
  await page.evaluate(() => openSeasonModal(null));
  await settled(page, '#season-modal .modal');

  await page.fill('#f-seasonLabel', '2025/26');
  await page.fill('#f-club', 'Riverside United');
  await page.evaluate(() => document.querySelectorAll('#season-modal details').forEach(d => d.open = true));
  await page.click('[data-action="add-row"][data-repeat="competitions"]');
  await page.fill('[data-repeat="competitions"][data-field="name"]', 'FA Cup');
  await page.selectOption('[data-repeat="competitions"][data-field="result"]', 'Winner');

  // Plain click, exactly as a user would -- no scrollIntoView, no force.
  await page.click('#season-form button[type="submit"]');
  await page.waitForTimeout(300);

  await expect(page.locator('#season-modal')).toBeHidden();
  const comps = await page.evaluate(() => state.seasons[0].competitions.map(c => `${c.name}:${c.result}`));
  expect(comps).toEqual(['FA Cup:Winner']);

  await page.evaluate(() => switchTab('trophies'));
  await page.waitForTimeout(800);
  await expect(page.locator('#trophies-content')).toContainText('FA Cup');
  expect(errors).toEqual([]);
});

test('the mobile sheet body scrolls internally instead of overflowing the sheet', async ({ page }) => {
  await mobileLayout(page);
  await page.evaluate(() => openSeasonModal(null));
  await settled(page, '#season-modal .modal');
  await page.evaluate(() => document.querySelectorAll('#season-modal details').forEach(d => d.open = true));
  await page.waitForTimeout(150);

  const m = await page.evaluate(() => {
    const modal = document.querySelector('#season-modal .modal');
    const body = document.querySelector('#season-form-body');
    const r = modal.getBoundingClientRect();
    return {
      scrollable: body.scrollHeight > body.clientHeight,
      withinViewport: r.top >= 0 && r.bottom <= window.innerHeight + 1,
    };
  });
  expect(m.scrollable).toBe(true);
  expect(m.withinViewport).toBe(true);
});

test('every mobile sheet renders fully inside the viewport', async ({ page }) => {
  await mobileLayout(page);
  const cases = [
    ['#save-manager-modal', () => openSaveManagerModal()],
    ['#confirm-modal', () => confirmDialog('Delete this?', () => {})],
    ['#ocr-tutorial-modal', () => openOcrTutorialModal()],
  ];
  for (const [sel, open] of cases) {
    await page.evaluate(open);
    await settled(page, sel + ' .modal');
    const r = await page.evaluate((sel) => {
      const box = document.querySelector(sel + ' .modal').getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, h: box.height };
    }, sel);
    expect(r.h, `${sel} has height`).toBeGreaterThan(0);
    expect(r.top, `${sel} top edge on-screen`).toBeGreaterThanOrEqual(0);
    expect(r.bottom, `${sel} bottom edge on-screen`).toBeLessThanOrEqual(845);
    await page.evaluate(() => {
      closeSaveManagerModal(); closeConfirmModal(); closeOcrTutorialModal();
    });
    await page.waitForTimeout(100);
  }
});

// Regression coverage: the topbar title held its full intrinsic width, which
// pushed the save button past the right edge and gave the whole page a few
// pixels of horizontal scroll on narrow screens.
test('no page-level horizontal overflow on any tab in mobile layout', async ({ page }) => {
  await mobileLayout(page);
  await page.evaluate(() => {
    const s = emptySeason();
    Object.assign(s, { seasonLabel: '2025/26', club: 'Riverside United Football Club' });
    s.league = { played: 38, won: 24, drawn: 8, lost: 6, gf: 78, ga: 34, points: 80, position: 2, leagueSize: 20 };
    state.seasons = [s];
    saveState();
  });
  for (const tab of ['dashboard', 'seasons', 'totals', 'transfers', 'settings']) {
    await page.evaluate(t => switchTab(t), tab);
    await page.waitForTimeout(200);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${tab} overflows horizontally`).toBeLessThanOrEqual(2);
  }
});
