// Shared setup helpers for the Playwright spec files in this directory.
// These call the app's own global functions/state directly (emptySeason(),
// state.seasons, saveState(), etc.) rather than driving the season form
// field-by-field for every test — the form itself is exercised directly in
// season-validation.spec.js and player-mode.spec.js.

async function freshApp(page) {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(300);
}

async function seedManagerSeason(page, overrides) {
  await page.evaluate((o) => {
    const s = emptySeason();
    Object.assign(s, { seasonLabel: '2024/25', club: 'Riverside United', divisionTier: 'Premier League' }, o.season || {});
    s.league = Object.assign(
      { played: 38, won: 28, drawn: 6, lost: 4, gf: 90, ga: 28, points: 90, position: 1, leagueSize: 20 },
      o.league || {}
    );
    if (o.competitions) s.competitions = o.competitions;
    if (o.transfersIn) s.transfersIn = o.transfersIn;
    if (o.transfersOut) s.transfersOut = o.transfersOut;
    state.seasons = [s];
    saveState();
  }, overrides || {});
}

async function seedPlayerSeason(page, overrides) {
  await page.evaluate((o) => {
    const s = emptyPlayerSeason();
    Object.assign(s, { seasonLabel: '2024/25', club: 'Riverside United' }, o.season || {});
    if (o.attack) s.attack = Object.assign(s.attack, o.attack);
    if (o.appearances) s.appearances = Object.assign(s.appearances, o.appearances);
    if (o.international) s.international = Object.assign(s.international, o.international);
    pState.seasons = [s];
    savePlayerState();
  }, overrides || {});
}

async function switchToPlayerMode(page) {
  await page.click('.mode-switch-btn[data-mode="player"]');
  await page.waitForTimeout(200);
}

module.exports = { freshApp, seedManagerSeason, seedPlayerSeason, switchToPlayerMode };
