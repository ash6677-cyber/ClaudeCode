const { test, expect } = require('@playwright/test');
const { freshApp } = require('./helpers');

test('backup nudge appears when overdue, exporting hides it and clears overdue state', async ({ page }) => {
  await freshApp(page);
  await page.evaluate(() => {
    const s = emptySeason();
    Object.assign(s, { seasonLabel: '2024/25', club: 'Riverside United' });
    s.league = { played: 10, won: 5, drawn: 3, lost: 2, gf: 20, ga: 10, points: 18, position: 3, leagueSize: 20 };
    state.seasons = [s];
    saveState();
    // Simulate "it's been three weeks since the last export" without
    // waiting three weeks.
    appSettings.lastBackupAt = Date.now() - 20 * 86400000;
    saveAppSettings();
    maybeShowBackupNudge();
  });
  await expect(page.locator('#backup-nudge')).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#backup-nudge [data-action="backup-nudge-export"]'),
  ]);
  expect(download.suggestedFilename()).toContain('manager-save.json');
  await expect(page.locator('#backup-nudge')).toBeHidden();

  const lastBackupAt = await page.evaluate(() => appSettings.lastBackupAt);
  expect(Date.now() - lastBackupAt).toBeLessThan(5000);
});

test('backup nudge stays hidden with no data, and dismiss snoozes it', async ({ page }) => {
  await freshApp(page);
  await page.evaluate(() => maybeShowBackupNudge());
  await expect(page.locator('#backup-nudge')).toBeHidden();

  await page.evaluate(() => {
    const s = emptySeason();
    Object.assign(s, { seasonLabel: '2024/25', club: 'Riverside United' });
    s.league = { played: 10, won: 5, drawn: 3, lost: 2, gf: 20, ga: 10, points: 18, position: 3, leagueSize: 20 };
    state.seasons = [s];
    saveState();
    appSettings.lastBackupAt = Date.now() - 20 * 86400000;
    saveAppSettings();
    maybeShowBackupNudge();
  });
  await expect(page.locator('#backup-nudge')).toBeVisible();

  await page.click('#backup-nudge [data-action="backup-nudge-dismiss"]');
  await expect(page.locator('#backup-nudge')).toBeHidden();

  const snoozedUntil = await page.evaluate(() => appSettings.backupNudgeSnoozedUntil);
  expect(snoozedUntil).toBeGreaterThan(Date.now());

  await page.evaluate(() => maybeShowBackupNudge());
  await expect(page.locator('#backup-nudge')).toBeHidden();
});

test('Settings shows a "never backed up" or last-backup status line', async ({ page }) => {
  await freshApp(page);
  await page.evaluate(() => switchTab('settings'));
  await expect(page.locator('#settings-content')).toContainText('never exported a backup');

  await page.evaluate(() => {
    appSettings.lastBackupAt = Date.now();
    saveAppSettings();
    switchTab('settings');
  });
  await expect(page.locator('#settings-content')).toContainText('Last backup:');
});
