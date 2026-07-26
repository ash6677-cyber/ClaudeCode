const { test, expect } = require('@playwright/test');
const { freshApp } = require('./helpers');

async function openForm(page) {
  await freshApp(page);
  await page.evaluate(() => openSeasonModal(null));
  await page.waitForTimeout(150);
  await page.fill('#f-seasonLabel', '2025/26');
  await page.fill('#f-club', 'Riverside United');
  await page.evaluate(() => document.querySelectorAll('#season-modal details').forEach(d => d.open = true));
}

test('a squad player saves with the season and counts on the season card', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await openForm(page);

  await page.click('[data-action="add-row"][data-repeat="squad"]');
  await page.fill('[data-repeat="squad"][data-field="name"]', 'Marco Silva');
  await page.selectOption('[data-repeat="squad"][data-field="position"]', 'CAM');
  await page.fill('[data-repeat="squad"][data-field="apps"]', '34');
  await page.fill('[data-repeat="squad"][data-field="goals"]', '12');
  await page.fill('[data-repeat="squad"][data-field="assists"]', '9');
  await page.fill('[data-repeat="squad"][data-field="rating"]', '7.4');

  await page.evaluate(() => document.querySelector('#season-form').requestSubmit());
  await page.waitForTimeout(250);

  const saved = await page.evaluate(() => state.seasons[0].squad[0]);
  expect(saved.name).toBe('Marco Silva');
  expect(saved.position).toBe('CAM');
  expect(saved.apps).toBe('34');
  expect(saved.goals).toBe('12');

  await page.evaluate(() => switchTab('seasons'));
  await page.waitForTimeout(200);
  await expect(page.locator('#seasons-list .season-card-trophies')).toContainText('1 squad');
  expect(errors).toEqual([]);
});

test('a squad player who was signed this season is tagged from the transfer list', async ({ page }) => {
  await openForm(page);

  await page.click('[data-action="add-row"][data-repeat="transfersIn"]');
  await page.fill('[data-repeat="transfersIn"][data-field="name"]', 'Marco Silva');

  await page.click('[data-action="add-row"][data-repeat="squad"]');
  await page.fill('[data-repeat="squad"][data-field="name"]', 'Marco Silva');
  await page.waitForTimeout(150);
  await expect(page.locator('.squad-row .squad-status')).toHaveText('Signed');

  // The tag is derived, not stored -- renaming the transfer clears it.
  await page.fill('[data-repeat="transfersIn"][data-field="name"]', 'Someone Else');
  await page.waitForTimeout(150);
  await expect(page.locator('.squad-row .squad-status')).toHaveCount(0);
});

test('a squad player sold this season is tagged Sold, and loose name spellings still match', async ({ page }) => {
  await openForm(page);

  await page.click('[data-action="add-row"][data-repeat="transfersOut"]');
  await page.fill('[data-repeat="transfersOut"][data-field="name"]', 'M. Rashford');

  await page.click('[data-action="add-row"][data-repeat="squad"]');
  await page.fill('[data-repeat="squad"][data-field="name"]', 'm rashford');
  await page.waitForTimeout(150);
  await expect(page.locator('.squad-row .squad-status')).toHaveText('Sold');
});

test('"Add this season\'s signings" pulls signings in without duplicating them', async ({ page }) => {
  await openForm(page);

  await page.click('[data-action="add-row"][data-repeat="transfersIn"]');
  await page.fill('[data-repeat="transfersIn"][data-field="name"]', 'Marco Silva');
  await page.selectOption('[data-repeat="transfersIn"][data-field="position"]', 'CAM');
  await page.click('[data-action="add-row"][data-repeat="transfersIn"]');
  await page.locator('[data-repeat="transfersIn"][data-field="name"]').nth(1).fill('Ana Torres');

  await page.click('[data-action="import-signings-to-squad"]');
  await page.waitForTimeout(200);
  await expect(page.locator('.squad-row')).toHaveCount(2);
  expect(await page.locator('[data-repeat="squad"][data-field="name"]').first().inputValue()).toBe('Marco Silva');
  expect(await page.locator('[data-repeat="squad"][data-field="position"]').first().inputValue()).toBe('CAM');

  // Running it again must not duplicate anyone.
  await page.click('[data-action="import-signings-to-squad"]');
  await page.waitForTimeout(200);
  await expect(page.locator('.squad-row')).toHaveCount(2);
  await expect(page.locator('.toast').last()).toContainText('all in the squad already');
});

test('the Player Register aggregates a player across seasons and folds in their transfers', async ({ page }) => {
  await freshApp(page);
  await page.evaluate(() => {
    function season(label, squad, tIn, tOut) {
      const s = emptySeason();
      Object.assign(s, { seasonLabel: label, club: 'Riverside United' });
      s.league = { played: 38, won: 20, drawn: 10, lost: 8, gf: 60, ga: 40, points: 70, position: 4, leagueSize: 20 };
      s.squad = squad; s.transfersIn = tIn || []; s.transfersOut = tOut || [];
      return s;
    }
    const p = (name, apps, goals, assists, rating) =>
      Object.assign(emptySquadPlayer(), { name, position: 'ST', apps, goals, assists, rating });

    state.seasons = [
      season('2024/25', [p('Marco Silva', '30', '10', '5', '7.0')],
        [{ id: 't1', name: 'Marco Silva', position: 'ST', type: 'Permanent', fee: 40, club: 'Rival FC' }], []),
      season('2025/26', [p('Marco Silva', '34', '18', '7', '8.0')], [],
        [{ id: 't2', name: 'Marco Silva', position: 'ST', type: 'Permanent', fee: 65, club: 'Bigger FC' }]),
    ];
    saveState();
    switchTab('totals');
  });
  await page.waitForTimeout(400);

  const reg = await page.evaluate(() => computeCareerTotals().playerRegister);
  expect(reg).toHaveLength(1);
  const marco = reg[0];
  expect(marco.apps).toBe(64);          // 30 + 34
  expect(marco.goals).toBe(28);         // 10 + 18
  expect(marco.assists).toBe(12);       // 5 + 7
  expect(marco.seasonCount).toBe(2);
  expect(marco.avgRating).toBeCloseTo(7.5, 5);
  expect(marco.signedIn.season).toBe('2024/25');
  expect(marco.soldIn.season).toBe('2025/26');
  expect(marco.feeReceived - marco.feePaid).toBe(25); // 65 in, 40 out

  await expect(page.locator('#totals-content')).toContainText('Player Register');
  await expect(page.locator('#totals-content')).toContainText('Marco Silva');
});

test('a player only ever logged as a signing still appears in the register', async ({ page }) => {
  await freshApp(page);
  await page.evaluate(() => {
    const s = emptySeason();
    Object.assign(s, { seasonLabel: '2025/26', club: 'Riverside United' });
    s.league = { played: 38, won: 20, drawn: 10, lost: 8, gf: 60, ga: 40, points: 70, position: 4, leagueSize: 20 };
    s.transfersIn = [{ id: 't1', name: 'Unlisted Signing', position: 'CB', type: 'Permanent', fee: 12, club: 'Rival FC' }];
    state.seasons = [s];
    saveState();
  });
  const reg = await page.evaluate(() => computeCareerTotals().playerRegister);
  expect(reg.map(p => p.name)).toContain('Unlisted Signing');
  expect(reg[0].position).toBe('CB');
});

test('saves made before squads existed still load and show no register', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await freshApp(page);
  await page.evaluate(() => {
    return new Promise(resolve => {
      const legacy = JSON.stringify({
        manager: { name: 'Old Save' },
        seasons: [{ id: 's1', seasonLabel: '2023/24', club: 'Legacy FC',
          league: { played: 10, won: 5, drawn: 3, lost: 2, gf: 20, ga: 10, points: 18, position: 4, leagueSize: 20 } }]
      });
      importJSON(new File([legacy], 'old.json', { type: 'application/json' }));
      setTimeout(resolve, 300);
    });
  });
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => Array.isArray(state.seasons[0].squad))).toBe(true);
  await page.evaluate(() => switchTab('totals'));
  await page.waitForTimeout(300);
  await expect(page.locator('#totals-content')).not.toContainText('Player Register');
});

/* ---------------- Carry-forward + transfer sync ---------------- */

async function seedPriorSeason(page) {
  await page.evaluate(() => {
    const s = emptySeason();
    Object.assign(s, { seasonLabel: '2024/25', club: 'Riverside United', divisionTier: 'Premier League' });
    s.league = { played: 38, won: 20, drawn: 10, lost: 8, gf: 60, ga: 40, points: 70, position: 4, leagueSize: 20 };
    const mk = (name, position, apps, goals) =>
      Object.assign(emptySquadPlayer(), { name, position, apps, goals, assists: '3', rating: '7.1' });
    s.squad = [mk('Marco Silva', 'CAM', '30', '10'), mk('Ana Torres', 'ST', '28', '19'), mk('Old Keeper', 'GK', '38', '0')];
    s.transfersOut = [{ id: 'o1', name: 'Old Keeper', position: 'GK', type: 'Permanent', fee: 3, club: 'Lower FC' }];
    state.seasons = [s];
    saveState();
  });
}

test('a new season inherits the previous squad, minus anyone sold, with stats reset', async ({ page }) => {
  await freshApp(page);
  await seedPriorSeason(page);
  await page.evaluate(() => openSeasonModal(null));
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelectorAll('#season-modal details').forEach(d => d.open = true));

  const carried = await page.evaluate(() => seasonDraft.squad.map(sp => ({ name: sp.name, position: sp.position, apps: sp.apps, goals: sp.goals })));
  expect(carried.map(p => p.name)).toEqual(['Marco Silva', 'Ana Torres']); // Old Keeper was sold
  expect(carried[0].position).toBe('CAM');
  expect(carried[0].apps).toBe('');   // per-season stats do not travel
  expect(carried[0].goals).toBe('');
  await expect(page.locator('.squad-carried-note')).toContainText('2024/25');
});

// The guarantee that matters most: a carried-forward squad must be a genuine
// copy. If the draft shared objects with the stored season, editing the new
// season would silently rewrite last season's squad.
test('editing the inherited squad never alters the season it came from', async ({ page }) => {
  await freshApp(page);
  await seedPriorSeason(page);
  await page.evaluate(() => openSeasonModal(null));
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelectorAll('#season-modal details').forEach(d => d.open = true));

  const ids = await page.evaluate(() => ({
    prior: state.seasons[0].squad.map(sp => sp.id),
    draft: seasonDraft.squad.map(sp => sp.id),
  }));
  ids.draft.forEach(id => expect(ids.prior).not.toContain(id));

  await page.fill('#f-seasonLabel', '2025/26');
  await page.fill('#f-club', 'Riverside United');
  await page.locator('[data-repeat="squad"][data-field="name"]').first().fill('Renamed Player');
  await page.locator('[data-repeat="squad"][data-field="goals"]').first().fill('99');
  await page.evaluate(() => document.querySelector('#season-form').requestSubmit());
  await page.waitForTimeout(250);

  const prior = await page.evaluate(() =>
    state.seasons.find(s => s.seasonLabel === '2024/25').squad.map(sp => `${sp.name}:${sp.goals}`));
  expect(prior).toEqual(['Marco Silva:10', 'Ana Torres:19', 'Old Keeper:0']);

  const next = await page.evaluate(() =>
    state.seasons.find(s => s.seasonLabel === '2025/26').squad.map(sp => `${sp.name}:${sp.goals}`));
  expect(next).toEqual(['Renamed Player:99', 'Ana Torres:']);
});

test('logging a signing adds that player to the squad automatically', async ({ page }) => {
  await freshApp(page);
  await page.evaluate(() => openSeasonModal(null));
  await page.waitForTimeout(150);
  await page.evaluate(() => document.querySelectorAll('#season-modal details').forEach(d => d.open = true));

  await page.click('[data-action="add-row"][data-repeat="transfersIn"]');
  await page.fill('[data-repeat="transfersIn"][data-field="name"]', 'New Striker');
  await page.selectOption('[data-repeat="transfersIn"][data-field="position"]', 'ST');
  await page.locator('[data-repeat="transfersIn"][data-field="name"]').blur();
  await page.waitForTimeout(250);

  await expect(page.locator('.squad-row')).toHaveCount(1);
  expect(await page.locator('[data-repeat="squad"][data-field="name"]').first().inputValue()).toBe('New Striker');
  await expect(page.locator('.squad-row .squad-status')).toHaveText('Signed');
});

test('Sell on a squad row creates the transfer out and tags the player', async ({ page }) => {
  await freshApp(page);
  await seedPriorSeason(page);
  await page.evaluate(() => openSeasonModal(null));
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelectorAll('#season-modal details').forEach(d => d.open = true));

  await page.locator('.squad-row').first().locator('[data-action="sell-squad-player"]').click();
  await page.waitForTimeout(250);

  const out = await page.evaluate(() => seasonDraft.transfersOut.map(t => `${t.name}:${t.position}`));
  expect(out).toEqual(['Marco Silva:CAM']);
  await expect(page.locator('.squad-row').first().locator('.squad-status')).toHaveText('Sold');

  // And that player is then left behind by the following season.
  await page.fill('#f-seasonLabel', '2025/26');
  await page.fill('#f-club', 'Riverside United');
  await page.evaluate(() => document.querySelector('#season-form').requestSubmit());
  await page.waitForTimeout(250);
  await page.evaluate(() => openSeasonModal(null));
  await page.waitForTimeout(200);
  const nextSquad = await page.evaluate(() => seasonDraft.squad.map(sp => sp.name));
  expect(nextSquad).not.toContain('Marco Silva');
  expect(nextSquad).toContain('Ana Torres');
});

test('opening an existing season for editing never re-inherits a squad', async ({ page }) => {
  await freshApp(page);
  await seedPriorSeason(page);
  await page.evaluate(() => openSeasonModal(state.seasons[0]));
  await page.waitForTimeout(200);
  const names = await page.evaluate(() => seasonDraft.squad.map(sp => sp.name));
  expect(names).toEqual(['Marco Silva', 'Ana Torres', 'Old Keeper']);
  await expect(page.locator('.squad-carried-note')).toHaveCount(0);
});
