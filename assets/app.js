'use strict';

/* ===========================================================
   FC Career Tracker — application logic
   Single-file, no build step, persists to localStorage.
   =========================================================== */

/* ---------------- Constants ---------------- */

const COMPETITION_TYPES = [
  'Domestic Cup', 'League Cup', 'Domestic Super Cup',
  'Champions League', 'Europa League', 'Conference League',
  'Club World Cup', 'Other Continental Cup', 'Other'
];

const RESULT_OPTIONS = [
  'Winner', 'Runner-up', 'Semi-Finalist', 'Quarter-Finalist',
  'Round of 16', 'Round of 32', 'Group Stage', 'Did Not Qualify', 'Other'
];

const TRANSFER_TYPES = ['Permanent', 'Loan', 'Loan with Obligation', 'Free Transfer'];

const PLAYER_POSITIONS = ['GK','CB','LB','RB','LWB','RWB','CDM','CM','CAM','LM','RM','LW','RW','ST','CF'];

const SEASON_SECTIONS = [
  { id: 'fs-basics', label: 'Basics', icon: '📋' },
  { id: 'fs-league', label: 'League', icon: '🏟️' },
  { id: 'fs-matches', label: 'Matches', icon: '📅' },
  { id: 'fs-competitions', label: 'Cups', icon: '🏆' },
  { id: 'fs-awards', label: 'Awards', icon: '⭐' },
  { id: 'fs-standing', label: 'Standing', icon: '📈' },
  { id: 'fs-transfers-in', label: 'Signings', icon: '⬇️' },
  { id: 'fs-transfers-out', label: 'Sales', icon: '⬆️' },
  { id: 'fs-finances', label: 'Finances', icon: '💰' },
  { id: 'fs-objectives', label: 'Objectives', icon: '🎯' },
  { id: 'fs-youth', label: 'Youth', icon: '🌱' },
  { id: 'fs-notes', label: 'Notes', icon: '📝' }
];

const PLAYER_SEASON_SECTIONS = [
  { id: 'pfs-basics', label: 'Basics', icon: '📋' },
  { id: 'pfs-ratings', label: 'Ratings', icon: '📊' },
  { id: 'pfs-appearances', label: 'Apps', icon: '👟' },
  { id: 'pfs-matches', label: 'Matches', icon: '📅' },
  { id: 'pfs-attack', label: 'Attacking', icon: '⚽' },
  { id: 'pfs-defending', label: 'Defending', icon: '🛡️' },
  { id: 'pfs-goalkeeping', label: 'Goalkeeping', icon: '🧤' },
  { id: 'pfs-discipline', label: 'Discipline', icon: '🟨' },
  { id: 'pfs-team', label: 'Team Season', icon: '🏟️' },
  { id: 'pfs-awards', label: 'Awards', icon: '⭐' },
  { id: 'pfs-transfer', label: 'Transfer', icon: '🔄' },
  { id: 'pfs-contract', label: 'Contract', icon: '📄' },
  { id: 'pfs-international', label: 'International', icon: '🌍' },
  { id: 'pfs-notes', label: 'Notes', icon: '📝' }
];
/* ---------------- Helpers ---------------- */

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function uid(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function num(v, fallback) {
  const n = parseFloat(v);
  return isNaN(n) ? (fallback === undefined ? 0 : fallback) : n;
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

function parseSeasonStartYear(label) {
  const m = String(label || '').match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : 0;
}

function sortedSeasons(seasons, order) {
  const arr = seasons.slice();
  order = order || 'chrono';
  if (order === 'chrono') {
    arr.sort((a, b) => parseSeasonStartYear(a.seasonLabel) - parseSeasonStartYear(b.seasonLabel));
  } else if (order === 'newest') {
    arr.sort((a, b) => parseSeasonStartYear(b.seasonLabel) - parseSeasonStartYear(a.seasonLabel));
  } else if (order === 'oldest') {
    arr.sort((a, b) => parseSeasonStartYear(a.seasonLabel) - parseSeasonStartYear(b.seasonLabel));
  } else if (order === 'position') {
    arr.sort((a, b) => (num(a.league.position, 999) || 999) - (num(b.league.position, 999) || 999));
  } else if (order === 'trophies') {
    arr.sort((a, b) => seasonTrophyCount(b) - seasonTrophyCount(a));
  }
  return arr;
}

function winPct(w, d, l) {
  const p = w + d + l;
  return p > 0 ? (w / p * 100) : 0;
}

function fmtPct(n) { return (isFinite(n) ? n : 0).toFixed(1) + '%'; }

function fmtM(amount, currency) {
  currency = currency || '£';
  const n = num(amount, 0);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1000) return sign + currency + (abs / 1000).toFixed(2) + 'B';
  return sign + currency + abs.toFixed(1) + 'M';
}

function fmtNum(n) { return Number(n || 0).toLocaleString(); }

function ordinal(n) {
  n = parseInt(n, 10);
  if (!n) return '—';
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/* ---------------- Data model ---------------- */

function emptyManagerProfile() {
  return { name: '', nationality: '', startingClub: '', careerStartYear: '' };
}

function emptyManagerSaveData() {
  return { manager: emptyManagerProfile(), seasons: [] };
}

function emptySeason() {
  return {
    id: uid('season'),
    seasonLabel: '',
    club: '',
    country: '',
    divisionTier: '',
    league: {
      played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0,
      position: '', leagueSize: '', promoted: false, relegated: false, playoff: false
    },
    competitions: [],
    matches: [],
    playerAwards: {
      topScorerName: '', topScorerGoals: '', topAssisterName: '', topAssisterAssists: '',
      playerOfTheSeason: '', youngPlayerOfTheSeason: '', teamOfTheSeason: '',
      goldenBoot: false, goldenGlove: false, otherAwards: ''
    },
    managerStanding: { managerOfTheSeason: false, motmCount: 0, reputationStars: 3, jobSecurity: 70 },
    transfersIn: [],
    transfersOut: [],
    finances: { transferBudget: '', wageBudget: '', prizeMoney: '', sponsorship: '' },
    boardObjectives: [],
    youth: { playersPromoted: '', regensGenerated: '', notes: '' },
    notes: ''
  };
}

function emptyCompetition() {
  return { id: uid('comp'), name: '', type: 'Domestic Cup', result: 'Winner', played: '', won: '', drawn: '', lost: '', gf: '', ga: '' };
}
function emptyTransfer() {
  return { id: uid('tr'), name: '', position: 'ST', fee: '', club: '', type: 'Permanent' };
}
function emptyObjective() {
  return { id: uid('obj'), description: '', achieved: false };
}
function emptyMatch() {
  return { id: uid('match'), date: '', competition: '', opponent: '', venue: 'Home', gf: '', ga: '' };
}

// null (not W/D/L) until both scores are filled in, so a half-entered row
// doesn't render a misleading result badge.
function matchResult(gf, ga) {
  if (gf === '' || gf == null || ga === '' || ga == null) return null;
  const a = num(gf), b = num(ga);
  if (a > b) return 'W';
  if (a < b) return 'L';
  return 'D';
}

/* ---------------- Player Career data model ---------------- */

function emptyPlayerProfile() {
  return { name: '', nationality: '', position: 'ST', startingClub: '', careerStartYear: '' };
}

function emptyPlayerSaveData() {
  return { player: emptyPlayerProfile(), seasons: [] };
}

function emptyPlayerSeason() {
  return {
    id: uid('pseason'),
    seasonLabel: '', club: '', country: '', divisionTier: '', age: '', shirtNumber: '',
    ratings: { overallStart: '', overallEnd: '', potential: '', skillMoves: 3, weakFoot: 3 },
    appearances: { played: 0, started: 0, subApps: 0, minutes: 0 },
    attack: { goals: 0, assists: 0, shotsOnTarget: 0, shotsTotal: 0, keyPasses: 0, dribbles: 0 },
    defending: { tackles: 0, interceptions: 0, duelsWon: 0 },
    goalkeeping: { saves: 0, goalsConceded: 0, cleanSheets: 0 },
    discipline: { yellow: 0, red: 0, fouls: 0 },
    form: { avgRating: '', motmCount: 0 },
    league: { position: '', leagueSize: '', promoted: false, relegated: false },
    competitions: [],
    matches: [],
    awards: {
      potsClub: false, yotsClub: false, teamOfSeason: false,
      goldenBoot: false, goldenGlove: false, ballonDorRank: '', otherAwards: ''
    },
    transfer: { moved: false, fromClub: '', toClub: '', fee: '', type: 'Permanent' },
    contract: { wage: '', yearsRemaining: '', releaseClause: '' },
    international: { calledUp: false, team: '', caps: 0, goals: 0, tournament: '', tournamentResult: '' },
    notes: ''
  };
}

function emptyPlayerCompetition() {
  return { id: uid('pcomp'), name: '', type: 'Domestic Cup', result: 'Winner', apps: '', goals: '', assists: '' };
}
function emptyPlayerMatch() {
  return { id: uid('pmatch'), date: '', competition: '', opponent: '', venue: 'Home', gf: '', ga: '', goals: '', assists: '', rating: '' };
}

/* ---------------- Storage: global settings + per-mode save slots ---------------- */

const APP_SETTINGS_KEY = 'fc-tracker:app-settings';
const MANAGER_SAVES_KEY = 'fc-tracker:manager-saves';
const PLAYER_SAVES_KEY = 'fc-tracker:player-saves';
const LEGACY_STATE_KEY = 'fc-career-tracker:v1';
const MAX_SAVES_PER_MODE = 100;

function defaultAppSettings() {
  return {
    theme: 'dark', currency: '£', mode: 'manager', layout: 'desktop', renderQuality: 'auto',
    activeManagerSaveId: null, activePlayerSaveId: null,
    lastBackupAt: null, backupNudgeSnoozedUntil: null
  };
}

function loadAppSettings() {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return Object.assign(defaultAppSettings(), parsed);
  } catch (e) {
    return defaultAppSettings();
  }
}

function saveAppSettings() {
  localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(appSettings));
}

function savesKey(mode) { return mode === 'player' ? PLAYER_SAVES_KEY : MANAGER_SAVES_KEY; }

function loadSaves(mode) {
  try {
    const raw = localStorage.getItem(savesKey(mode));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function persistSaves(mode, saves) {
  localStorage.setItem(savesKey(mode), JSON.stringify(saves));
}

function emptySaveData(mode) {
  return mode === 'player' ? emptyPlayerSaveData() : emptyManagerSaveData();
}

function saveDisplayName(mode, saveObj) {
  if (saveObj.name && saveObj.name.trim()) return saveObj.name.trim();
  if (mode === 'player') return (saveObj.player && saveObj.player.name) || 'Unnamed Player';
  return (saveObj.manager && saveObj.manager.name) || 'Unnamed Career';
}

function migrateLegacyStateIfNeeded() {
  const raw = localStorage.getItem(LEGACY_STATE_KEY);
  if (!raw) return;
  const existingManagerSaves = loadSaves('manager');
  if (existingManagerSaves.length) { localStorage.removeItem(LEGACY_STATE_KEY); return; }
  try {
    const parsed = JSON.parse(raw);
    const now = Date.now();
    const save = {
      id: uid('save'), name: (parsed.manager && parsed.manager.name) ? parsed.manager.name + "'s Career" : 'My Career',
      createdAt: now, updatedAt: now,
      manager: Object.assign(emptyManagerProfile(), parsed.manager || {}),
      seasons: Array.isArray(parsed.seasons) ? parsed.seasons : []
    };
    persistSaves('manager', [save]);
    const settings = loadAppSettings();
    settings.activeManagerSaveId = save.id;
    if (parsed.settings) {
      if (parsed.settings.theme) settings.theme = parsed.settings.theme;
      if (parsed.settings.currency) settings.currency = parsed.settings.currency;
    }
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) { /* ignore corrupt legacy data */ }
  localStorage.removeItem(LEGACY_STATE_KEY);
}

function createSave(mode, name) {
  const saves = loadSaves(mode);
  if (saves.length >= MAX_SAVES_PER_MODE) {
    toast(`Save limit reached (${MAX_SAVES_PER_MODE}/${MAX_SAVES_PER_MODE}) for this mode`, 'danger');
    return null;
  }
  const now = Date.now();
  const save = Object.assign(
    { id: uid('save'), name: name && name.trim() ? name.trim() : (mode === 'player' ? 'New Player' : 'New Career'), createdAt: now, updatedAt: now },
    emptySaveData(mode)
  );
  saves.push(save);
  persistSaves(mode, saves);
  return save;
}

function getActiveSave(mode) {
  const saves = loadSaves(mode);
  const activeId = mode === 'player' ? appSettings.activePlayerSaveId : appSettings.activeManagerSaveId;
  let save = saves.find(s => s.id === activeId);
  if (!save && saves.length) save = saves[0];
  if (!save) save = createSave(mode, null);
  setActiveSaveId(mode, save.id);
  return save;
}

function setActiveSaveId(mode, id) {
  if (mode === 'player') appSettings.activePlayerSaveId = id;
  else appSettings.activeManagerSaveId = id;
  saveAppSettings();
}

function persistActiveSave(mode, saveObj) {
  const saves = loadSaves(mode);
  const idx = saves.findIndex(s => s.id === saveObj.id);
  saveObj.updatedAt = Date.now();
  if (idx >= 0) saves[idx] = saveObj;
  else saves.push(saveObj);
  persistSaves(mode, saves);
}

function renameSave(mode, id, name) {
  const saves = loadSaves(mode);
  const save = saves.find(s => s.id === id);
  if (!save) return;
  save.name = name.trim() || saveDisplayName(mode, save);
  save.updatedAt = Date.now();
  persistSaves(mode, saves);
  if (mode === 'manager' && state.id === id) state.name = save.name;
  if (mode === 'player' && pState.id === id) pState.name = save.name;
}

function duplicateSave(mode, id) {
  const saves = loadSaves(mode);
  if (saves.length >= MAX_SAVES_PER_MODE) {
    toast(`Save limit reached (${MAX_SAVES_PER_MODE}/${MAX_SAVES_PER_MODE}) for this mode`, 'danger');
    return null;
  }
  const original = saves.find(s => s.id === id);
  if (!original) return null;
  const now = Date.now();
  const copy = deepClone(original);
  copy.id = uid('save');
  copy.name = saveDisplayName(mode, original) + ' (Copy)';
  copy.createdAt = now;
  copy.updatedAt = now;
  saves.push(copy);
  persistSaves(mode, saves);
  return copy;
}

function deleteSaveSlot(mode, id) {
  let saves = loadSaves(mode);
  saves = saves.filter(s => s.id !== id);
  persistSaves(mode, saves);
  const activeId = mode === 'player' ? appSettings.activePlayerSaveId : appSettings.activeManagerSaveId;
  if (activeId === id) {
    const next = saves[0] || createSave(mode, null);
    setActiveSaveId(mode, next.id);
    if (mode === 'manager') state = getActiveSave('manager');
    else pState = getActiveSave('player');
  }
}

/* ---------------- Save Manager ---------------- */

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const min = 60000, hr = 3600000, day = 86400000;
  if (diff < min) return 'just now';
  if (diff < hr) return Math.floor(diff / min) + 'm ago';
  if (diff < day) return Math.floor(diff / hr) + 'h ago';
  if (diff < day * 30) return Math.floor(diff / day) + 'd ago';
  return new Date(ts).toLocaleDateString();
}

function saveStatsLine(mode, saveObj) {
  const seasons = saveObj.seasons || [];
  if (mode === 'player') {
    let goals = 0, assists = 0;
    seasons.forEach(s => { goals += num(s.attack && s.attack.goals); assists += num(s.attack && s.attack.assists); });
    return `${seasons.length} season${seasons.length === 1 ? '' : 's'} · ${goals}G ${assists}A`;
  }
  let trophies = 0;
  seasons.forEach(s => { trophies += seasonTrophyCount(s); });
  return `${seasons.length} season${seasons.length === 1 ? '' : 's'} · ${trophies} trophies`;
}

function openSaveManagerModal() {
  saveManagerMode = appSettings.mode;
  saveManagerView = 'list';
  $('#save-manager-title').textContent = saveManagerMode === 'player' ? 'Player Saves' : 'Manager Saves';
  renderSaveManagerList();
  $('#save-manager-modal').hidden = false;
  document.body.style.overflow = 'hidden';
  focusModal($('#save-manager-modal'));
}

function closeSaveManagerModal() {
  $('#save-manager-modal').hidden = true;
  document.body.style.overflow = '';
  restoreFocusAfterModal();
}

function saveListCardsHTML(mode, query) {
  const saves = loadSaves(mode).sort((a, b) => b.updatedAt - a.updatedAt);
  const activeId = mode === 'player' ? appSettings.activePlayerSaveId : appSettings.activeManagerSaveId;
  const q = (query || '').toLowerCase().trim();
  const filtered = q ? saves.filter(s => saveDisplayName(mode, s).toLowerCase().includes(q)) : saves;

  return filtered.length ? filtered.map(s => {
    const isActive = s.id === activeId;
    return `<div class="save-card ${isActive ? 'is-active' : ''}" data-save-id="${s.id}" ${isActive ? '' : `data-action="switch-save" data-id="${s.id}"`}>
      <span class="manager-avatar">${esc(saveDisplayName(mode, s).trim().slice(0, 2).toUpperCase())}</span>
      <div class="save-card-main">
        <div class="save-card-name-row">
          <span class="save-card-name">${esc(saveDisplayName(mode, s))}</span>
          ${isActive ? '<span class="save-card-badge">Active</span>' : ''}
        </div>
        <div class="save-card-meta">${saveStatsLine(mode, s)} · updated ${timeAgo(s.updatedAt)}</div>
      </div>
      <div class="save-card-actions">
        ${isActive ? '' : `<button class="btn btn-ghost btn-sm btn-icon" data-action="switch-save" data-id="${s.id}" title="Switch to this save" aria-label="Switch to this save">⇄</button>`}
        <button class="btn btn-ghost btn-sm btn-icon" data-action="rename-save" data-id="${s.id}" title="Rename" aria-label="Rename save">✎</button>
        <button class="btn btn-ghost btn-sm btn-icon" data-action="duplicate-save" data-id="${s.id}" title="Duplicate" aria-label="Duplicate save">⧉</button>
        <button class="btn btn-ghost btn-sm btn-icon" data-action="delete-save" data-id="${s.id}" title="Delete" aria-label="Delete save">🗑</button>
      </div>
    </div>`;
  }).join('') : `<div class="empty-state" style="padding:40px 20px;"><p>No saves match your search.</p></div>`;
}

function refreshSaveListOnly(query) {
  const el = document.querySelector('#save-manager-body .save-list');
  if (el) el.innerHTML = saveListCardsHTML(saveManagerMode, query);
}

// Full aggregate stats for one save, read directly off the stored save
// object (not the active `state`/`pState`) so every save in the mode can be
// compared without switching into each one.
function leaderboardStatsForSave(mode, save) {
  const seasons = save.seasons || [];
  const name = saveDisplayName(mode, save);
  if (mode === 'player') {
    let apps = 0, goals = 0, assists = 0, trophies = 0;
    seasons.forEach(s => {
      apps += num(s.appearances && s.appearances.played);
      goals += num(s.attack && s.attack.goals);
      assists += num(s.attack && s.attack.assists);
      trophies += playerSeasonTrophyCount(s);
    });
    return { name, seasonCount: seasons.length, trophies, primary: goals + assists, primaryLabel: 'G+A', apps };
  }
  let won = 0, drawn = 0, lost = 0, trophies = 0;
  seasons.forEach(s => {
    won += num(s.league && s.league.won); drawn += num(s.league && s.league.drawn); lost += num(s.league && s.league.lost);
    trophies += seasonTrophyCount(s);
  });
  return { name, seasonCount: seasons.length, trophies, primary: winPct(won, drawn, lost), primaryLabel: 'Win Rate', record: `${won}-${drawn}-${lost}` };
}

function leaderboardTableHTML(mode) {
  const saves = loadSaves(mode);
  if (!saves.length) return `<div class="empty-state" style="padding:40px 20px;"><p>No saves to compare yet.</p></div>`;
  const rows = saves.map(s => leaderboardStatsForSave(mode, s)).sort((a, b) => b.trophies - a.trophies || b.primary - a.primary);
  const primaryLabel = rows[0].primaryLabel;
  const fmtPrimary = r => mode === 'player' ? fmtNum(r.primary) : fmtPct(r.primary);
  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>#</th><th>Save</th><th>Seasons</th><th>Trophies</th><th>${primaryLabel}</th></tr></thead>
        <tbody>${rows.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${esc(r.name)}</td>
            <td>${fmtNum(r.seasonCount)}</td>
            <td>${fmtNum(r.trophies)}</td>
            <td>${fmtPrimary(r)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderSaveManagerList(query) {
  const mode = saveManagerMode;
  const total = loadSaves(mode).length;
  const atCap = total >= MAX_SAVES_PER_MODE;

  const viewToggle = `
    <div class="save-manager-view-toggle">
      <button data-view="list" class="${saveManagerView === 'leaderboard' ? '' : 'active'}">Saves</button>
      <button data-view="leaderboard" class="${saveManagerView === 'leaderboard' ? 'active' : ''}">Leaderboard</button>
    </div>`;

  if (saveManagerView === 'leaderboard') {
    $('#save-manager-body').innerHTML = `
      <div class="save-manager-toolbar">
        ${viewToggle}
        <span class="save-manager-count">${total}/${MAX_SAVES_PER_MODE}</span>
      </div>
      ${leaderboardTableHTML(mode)}
    `;
    return;
  }

  $('#save-manager-body').innerHTML = `
    <div class="save-manager-toolbar">
      ${viewToggle}
      <span class="save-manager-count">${total}/${MAX_SAVES_PER_MODE}</span>
    </div>
    <input class="input" id="save-manager-search" type="text" placeholder="Search saves…" value="${esc(query || '')}" style="margin-bottom:12px;" />
    <div class="save-create-row">
      <input class="input" id="save-manager-new-name" type="text" placeholder="${mode === 'player' ? 'New player save name…' : 'New career save name…'}" ${atCap ? 'disabled' : ''} />
      <button class="btn btn-primary" id="save-manager-create-btn" data-action="create-save" ${atCap ? 'disabled' : ''}>+ Create</button>
    </div>
    <div class="save-list">${saveListCardsHTML(mode, query)}</div>
  `;
}

function startInlineRename(id) {
  const card = document.querySelector(`.save-card[data-save-id="${id}"]`);
  if (!card) return;
  const nameEl = card.querySelector('.save-card-name');
  const input = document.createElement('input');
  input.className = 'input save-card-name-input';
  input.value = nameEl.textContent;
  nameEl.replaceWith(input);
  input.focus();
  input.select();
  const commit = () => {
    renameSave(saveManagerMode, id, input.value);
    refreshSaveListOnly($('#save-manager-search') ? $('#save-manager-search').value : '');
    updateHeaderSubtitle();
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.removeEventListener('blur', commit); refreshSaveListOnly($('#save-manager-search') ? $('#save-manager-search').value : ''); }
  });
  input.addEventListener('blur', commit, { once: true });
}

function switchToSave(mode, id) {
  setActiveSaveId(mode, id);
  if (mode === 'manager') state = getActiveSave('manager');
  else pState = getActiveSave('player');
  closeSaveManagerModal();
  toast('Switched save');
  renderCurrentTab();
}

/* ---------------- Global runtime state ---------------- */

let appSettings = loadAppSettings();
migrateLegacyStateIfNeeded();
appSettings = loadAppSettings();
let state = null;   // active Manager-mode save
let pState = null;  // active Player-mode save
let currentTab = 'dashboard';
let seasonDraft = null;
let editingSeasonId = null;
let seasonModalMode = 'manager';
let playerSeasonDraft = null;
let editingPlayerSeasonId = null;
let confirmAction = null;
let saveManagerMode = 'manager';
let saveManagerView = 'list';

function saveState() { persistActiveSave('manager', state); }
function savePlayerState() { persistActiveSave('player', pState); }

/* ---------------- Trophy / stat computation ---------------- */

function seasonTrophyList(season) {
  const trophies = [];
  const league = season.league || {};
  if (num(league.position) === 1 && league.position !== '') {
    trophies.push({ name: (season.divisionTier || 'League') + ' Title', type: 'League' });
  }
  (season.competitions || []).forEach(c => {
    if (c.result === 'Winner') trophies.push({ name: c.name || c.type, type: c.type });
  });
  return trophies;
}

function seasonTrophyCount(season) { return seasonTrophyList(season).length; }

function computeCareerTotals() {
  const seasons = sortedSeasons(state.seasons, 'chrono');
  const currency = appSettings.currency;

  let matches = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0 };
  let leagueOnly = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0 };
  let promotions = 0, relegations = 0, playoffs = 0;
  let positionsSum = 0, positionsCount = 0;
  let trophiesByName = {};
  let totalTrophies = 0;
  let awards = { motsWins: 0, motmTotal: 0, goldenBoot: 0, goldenGlove: 0, potsCount: 0, yotsCount: 0 };
  let spend = 0, income = 0, prizeMoneyTotal = 0;
  let transfersInCount = 0, transfersOutCount = 0;
  let clubMap = {};

  seasons.forEach(s => {
    const L = s.league || {};
    leagueOnly.played += num(L.played); leagueOnly.won += num(L.won); leagueOnly.drawn += num(L.drawn);
    leagueOnly.lost += num(L.lost); leagueOnly.gf += num(L.gf); leagueOnly.ga += num(L.ga);

    matches.played += num(L.played); matches.won += num(L.won); matches.drawn += num(L.drawn);
    matches.lost += num(L.lost); matches.gf += num(L.gf); matches.ga += num(L.ga);

    (s.competitions || []).forEach(c => {
      matches.played += num(c.played); matches.won += num(c.won); matches.drawn += num(c.drawn);
      matches.lost += num(c.lost); matches.gf += num(c.gf); matches.ga += num(c.ga);
    });

    if (L.promoted) promotions++;
    if (L.relegated) relegations++;
    if (L.playoff) playoffs++;
    if (L.position !== '' && L.position !== undefined && L.position !== null) {
      positionsSum += num(L.position); positionsCount++;
    }

    seasonTrophyList(s).forEach(t => {
      trophiesByName[t.name] = trophiesByName[t.name] || { count: 0, entries: [], type: t.type };
      trophiesByName[t.name].count++;
      trophiesByName[t.name].entries.push({ season: s.seasonLabel, club: s.club });
      totalTrophies++;
    });

    const ms = s.managerStanding || {};
    if (ms.managerOfTheSeason) awards.motsWins++;
    awards.motmTotal += num(ms.motmCount);

    const pa = s.playerAwards || {};
    if (pa.goldenBoot) awards.goldenBoot++;
    if (pa.goldenGlove) awards.goldenGlove++;
    if (pa.playerOfTheSeason && pa.playerOfTheSeason.trim()) awards.potsCount++;
    if (pa.youngPlayerOfTheSeason && pa.youngPlayerOfTheSeason.trim()) awards.yotsCount++;

    (s.transfersIn || []).forEach(t => { spend += num(t.fee); transfersInCount++; });
    (s.transfersOut || []).forEach(t => { income += num(t.fee); transfersOutCount++; });
    prizeMoneyTotal += num((s.finances || {}).prizeMoney);

    const clubKey = s.club || 'Unknown Club';
    if (!clubMap[clubKey]) clubMap[clubKey] = { club: clubKey, seasons: [], played: 0, won: 0, drawn: 0, lost: 0, trophies: 0 };
    clubMap[clubKey].seasons.push(s.seasonLabel);
    clubMap[clubKey].played += num(L.played); clubMap[clubKey].won += num(L.won);
    clubMap[clubKey].drawn += num(L.drawn); clubMap[clubKey].lost += num(L.lost);
    clubMap[clubKey].trophies += seasonTrophyCount(s);
  });

  let bestSeason = null, bestScore = -Infinity;
  seasons.forEach(s => {
    const score = seasonTrophyCount(s) * 100 + (num(s.league.position) ? (100 - num(s.league.position)) : 0);
    if (score > bestScore) { bestScore = score; bestSeason = s; }
  });

  const clubHistory = Object.values(clubMap).map(c => ({
    club: c.club,
    first: c.seasons[0], last: c.seasons[c.seasons.length - 1],
    seasonCount: c.seasons.length,
    played: c.played, won: c.won, drawn: c.drawn, lost: c.lost,
    winPct: winPct(c.won, c.drawn, c.lost),
    trophies: c.trophies
  }));

  return {
    currency,
    totalSeasons: seasons.length,
    totalClubs: Object.keys(clubMap).length,
    matches, leagueOnly,
    winPct: winPct(matches.won, matches.drawn, matches.lost),
    leagueWinPct: winPct(leagueOnly.won, leagueOnly.drawn, leagueOnly.lost),
    goalDiff: matches.gf - matches.ga,
    promotions, relegations, playoffs,
    avgPosition: positionsCount ? (positionsSum / positionsCount) : null,
    trophiesByName, totalTrophies,
    awards,
    finances: { spend, income, net: spend - income, prizeMoneyTotal, transfersInCount, transfersOutCount },
    clubHistory,
    bestSeason,
    seasonsChrono: seasons
  };
}

// Auto-detected records, computed from data that's already there — no new
// input required. Season-level only (no per-match log exists yet), so
// "biggest win" etc. isn't possible until match-by-match logging exists;
// these are the records that ARE honestly computable at season grain.
function computeCareerRecords(seasons) {
  const records = [];
  const played = seasons.filter(s => num(s.league.played) > 0);

  if (played.length) {
    const bestGD = played.reduce((a, b) => (num(a.league.gf) - num(a.league.ga)) >= (num(b.league.gf) - num(b.league.ga)) ? a : b);
    const gd = num(bestGD.league.gf) - num(bestGD.league.ga);
    records.push({ icon: '⚡', label: 'Best Goal Difference', value: (gd > 0 ? '+' : '') + gd, detail: `${bestGD.seasonLabel} — ${bestGD.club}` });

    const mostGoals = played.reduce((a, b) => num(a.league.gf) >= num(b.league.gf) ? a : b);
    records.push({ icon: '⚽', label: 'Most Goals Scored (season)', value: num(mostGoals.league.gf), detail: `${mostGoals.seasonLabel} — ${mostGoals.club}` });

    const fewestConceded = played.reduce((a, b) => num(a.league.ga) <= num(b.league.ga) ? a : b);
    records.push({ icon: '🧱', label: 'Fewest Goals Conceded (season)', value: num(fewestConceded.league.ga), detail: `${fewestConceded.seasonLabel} — ${fewestConceded.club}` });

    const bestRate = played.reduce((a, b) => winPct(num(a.league.won), num(a.league.drawn), num(a.league.lost)) >= winPct(num(b.league.won), num(b.league.drawn), num(b.league.lost)) ? a : b);
    records.push({ icon: '📈', label: 'Best Win Rate (season)', value: fmtPct(winPct(num(bestRate.league.won), num(bestRate.league.drawn), num(bestRate.league.lost))), detail: `${bestRate.seasonLabel} — ${bestRate.club}` });

    const invincibles = played.filter(s => num(s.league.lost) === 0);
    if (invincibles.length) {
      records.push({ icon: '🛡️', label: invincibles.length > 1 ? 'Invincible Seasons' : 'Invincible Season', value: invincibles.length, detail: invincibles.map(s => `${s.seasonLabel} (${s.club})`).join(', ') });
    }

    const positioned = played.filter(s => num(s.league.position) > 0);
    if (positioned.length) {
      const best = positioned.reduce((a, b) => num(a.league.position) <= num(b.league.position) ? a : b);
      records.push({ icon: '🏅', label: 'Highest League Finish', value: ordinal(num(best.league.position)), detail: `${best.seasonLabel} — ${best.club}` });
    }
  }

  const trophyHauls = seasons.map(s => ({ s, count: seasonTrophyCount(s) })).filter(x => x.count > 0);
  if (trophyHauls.length) {
    const best = trophyHauls.reduce((a, b) => a.count >= b.count ? a : b);
    records.push({ icon: '🏆', label: 'Best Trophy Haul', value: `${best.count} in one season`, detail: `${best.s.seasonLabel} — ${best.s.club}` });
  }

  return records;
}

function playerCareerRecords(seasons) {
  const records = [];
  const played = seasons.filter(s => num(s.appearances.played) > 0);

  if (played.length) {
    const mostGoals = played.reduce((a, b) => num(a.attack.goals) >= num(b.attack.goals) ? a : b);
    records.push({ icon: '⚽', label: 'Most Goals (season)', value: num(mostGoals.attack.goals), detail: `${mostGoals.seasonLabel} — ${mostGoals.club}` });

    const mostAssists = played.reduce((a, b) => num(a.attack.assists) >= num(b.attack.assists) ? a : b);
    records.push({ icon: '🎯', label: 'Most Assists (season)', value: num(mostAssists.attack.assists), detail: `${mostAssists.seasonLabel} — ${mostAssists.club}` });

    const bestContribution = played.reduce((a, b) => (num(a.attack.goals) + num(a.attack.assists)) >= (num(b.attack.goals) + num(b.attack.assists)) ? a : b);
    records.push({ icon: '🔥', label: 'Best Goal Contribution (season)', value: num(bestContribution.attack.goals) + num(bestContribution.attack.assists), detail: `${bestContribution.seasonLabel} — ${bestContribution.club}` });

    const rated = played.filter(s => num(s.form.avgRating) > 0);
    if (rated.length) {
      const best = rated.reduce((a, b) => num(a.form.avgRating) >= num(b.form.avgRating) ? a : b);
      records.push({ icon: '⭐', label: 'Highest Avg. Rating (season)', value: num(best.form.avgRating).toFixed(2), detail: `${best.seasonLabel} — ${best.club}` });
    }

    const mostApps = played.reduce((a, b) => num(a.appearances.played) >= num(b.appearances.played) ? a : b);
    records.push({ icon: '👟', label: 'Most Appearances (season)', value: num(mostApps.appearances.played), detail: `${mostApps.seasonLabel} — ${mostApps.club}` });
  }

  const trophyHauls = seasons.map(s => ({ s, count: playerSeasonTrophyCount(s) })).filter(x => x.count > 0);
  if (trophyHauls.length) {
    const best = trophyHauls.reduce((a, b) => a.count >= b.count ? a : b);
    records.push({ icon: '🏆', label: 'Best Trophy Haul', value: `${best.count} in one season`, detail: `${best.s.seasonLabel} — ${best.s.club}` });
  }

  return records;
}

function recordsSectionHtml(records) {
  if (!records.length) return '';
  const tiles = records.map(r => `
    <div class="stat-tile">
      <div class="stat-label">${r.icon} ${esc(r.label)}</div>
      <div class="stat-value">${esc(String(r.value))}</div>
      <div class="stat-sub">${esc(r.detail)}</div>
    </div>`).join('');
  return `<div class="section-title">Career Records</div><div class="stat-grid">${tiles}</div>`;
}

/* ---------------- Player Career: trophy / stat computation ---------------- */

function playerSeasonTrophyList(season) {
  const trophies = [];
  const league = season.league || {};
  if (num(league.position) === 1 && league.position !== '') {
    trophies.push({ name: (season.divisionTier || 'League') + ' Title', type: 'League' });
  }
  (season.competitions || []).forEach(c => {
    if (c.result === 'Winner') trophies.push({ name: c.name || c.type, type: c.type });
  });
  return trophies;
}

function playerSeasonTrophyCount(season) { return playerSeasonTrophyList(season).length; }

function playerSortedSeasons(seasons, order) {
  const arr = seasons.slice();
  order = order || 'chrono';
  if (order === 'newest') arr.sort((a, b) => parseSeasonStartYear(b.seasonLabel) - parseSeasonStartYear(a.seasonLabel));
  else if (order === 'goals') arr.sort((a, b) => num(b.attack.goals) - num(a.attack.goals));
  else if (order === 'rating') arr.sort((a, b) => num(b.form.avgRating) - num(a.form.avgRating));
  else arr.sort((a, b) => parseSeasonStartYear(a.seasonLabel) - parseSeasonStartYear(b.seasonLabel));
  return arr;
}

function computePlayerCareerTotals() {
  const seasons = playerSortedSeasons(pState.seasons, 'chrono');

  let appearances = { played: 0, started: 0, subApps: 0, minutes: 0 };
  let attack = { goals: 0, assists: 0, shotsOnTarget: 0, shotsTotal: 0, keyPasses: 0, dribbles: 0 };
  let defending = { tackles: 0, interceptions: 0, duelsWon: 0 };
  let goalkeeping = { saves: 0, goalsConceded: 0, cleanSheets: 0 };
  let discipline = { yellow: 0, red: 0, fouls: 0 };
  let ratingSum = 0, ratingWeight = 0, motmTotal = 0;
  let promotions = 0, relegations = 0;
  let trophiesByName = {}, totalTrophies = 0;
  let awards = { potsClub: 0, yotsClub: 0, teamOfSeason: 0, goldenBoot: 0, goldenGlove: 0, ballonDor: [] };
  let intl = { caps: 0, goals: 0, tournaments: [] };
  let clubMap = {};

  seasons.forEach(s => {
    const A = s.appearances || {}, AT = s.attack || {}, D = s.defending || {}, GK = s.goalkeeping || {}, DI = s.discipline || {}, F = s.form || {}, L = s.league || {}, AW = s.awards || {}, I = s.international || {};

    appearances.played += num(A.played); appearances.started += num(A.started);
    appearances.subApps += num(A.subApps); appearances.minutes += num(A.minutes);
    attack.goals += num(AT.goals); attack.assists += num(AT.assists);
    attack.shotsOnTarget += num(AT.shotsOnTarget); attack.shotsTotal += num(AT.shotsTotal);
    attack.keyPasses += num(AT.keyPasses); attack.dribbles += num(AT.dribbles);
    defending.tackles += num(D.tackles); defending.interceptions += num(D.interceptions); defending.duelsWon += num(D.duelsWon);
    goalkeeping.saves += num(GK.saves); goalkeeping.goalsConceded += num(GK.goalsConceded); goalkeeping.cleanSheets += num(GK.cleanSheets);
    discipline.yellow += num(DI.yellow); discipline.red += num(DI.red); discipline.fouls += num(DI.fouls);
    if (F.avgRating !== '' && F.avgRating !== undefined && num(A.played) > 0) { ratingSum += num(F.avgRating) * num(A.played); ratingWeight += num(A.played); }
    motmTotal += num(F.motmCount);

    if (L.promoted) promotions++;
    if (L.relegated) relegations++;

    playerSeasonTrophyList(s).forEach(t => {
      trophiesByName[t.name] = trophiesByName[t.name] || { count: 0, entries: [], type: t.type };
      trophiesByName[t.name].count++;
      trophiesByName[t.name].entries.push({ season: s.seasonLabel, club: s.club });
      totalTrophies++;
    });

    if (AW.potsClub) awards.potsClub++;
    if (AW.yotsClub) awards.yotsClub++;
    if (AW.teamOfSeason) awards.teamOfSeason++;
    if (AW.goldenBoot) awards.goldenBoot++;
    if (AW.goldenGlove) awards.goldenGlove++;
    if (AW.ballonDorRank) awards.ballonDor.push({ season: s.seasonLabel, rank: AW.ballonDorRank });

    if (I.calledUp) {
      intl.caps += num(I.caps); intl.goals += num(I.goals);
      if (I.tournament) intl.tournaments.push({ season: s.seasonLabel, tournament: I.tournament, team: I.team, result: I.tournamentResult });
    }

    const clubKey = s.club || 'Unknown Club';
    if (!clubMap[clubKey]) clubMap[clubKey] = { club: clubKey, seasons: [], apps: 0, goals: 0, assists: 0, trophies: 0 };
    clubMap[clubKey].seasons.push(s.seasonLabel);
    clubMap[clubKey].apps += num(A.played); clubMap[clubKey].goals += num(AT.goals); clubMap[clubKey].assists += num(AT.assists);
    clubMap[clubKey].trophies += playerSeasonTrophyCount(s);
  });

  let bestSeason = null, bestScore = -Infinity;
  seasons.forEach(s => {
    const score = playerSeasonTrophyCount(s) * 100 + num(s.attack.goals) * 2 + num(s.attack.assists);
    if (score > bestScore) { bestScore = score; bestSeason = s; }
  });

  const clubHistory = Object.values(clubMap).map(c => ({
    club: c.club, first: c.seasons[0], last: c.seasons[c.seasons.length - 1],
    seasonCount: c.seasons.length, apps: c.apps, goals: c.goals, assists: c.assists, trophies: c.trophies
  }));

  return {
    totalSeasons: seasons.length,
    totalClubs: Object.keys(clubMap).length,
    appearances, attack, defending, goalkeeping, discipline,
    avgRating: ratingWeight ? (ratingSum / ratingWeight) : null,
    motmTotal, promotions, relegations,
    goalContributions: attack.goals + attack.assists,
    goalsPerGame: appearances.played ? (attack.goals / appearances.played) : 0,
    trophiesByName, totalTrophies, awards, intl,
    clubHistory, bestSeason,
    seasonsChrono: seasons
  };
}

/* ---------------- Toast ---------------- */

function toast(msg, kind) {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = 'toast' + (kind === 'danger' ? ' toast-danger' : '');
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 220);
  }, 2400);
}

// Highlights the specific field(s) a validation error is about — a toast
// alone tells you something's wrong but not where, especially inside a long
// multi-section form. Opens the field's collapsed section if needed, marks
// it red with a small shake, scrolls the first one into view, and clears
// itself the moment the user edits that field.
function focusFieldErrors(...ids) {
  let firstEl = null;
  ids.filter(Boolean).forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const details = el.closest('details');
    if (details) details.open = true;
    el.classList.remove('field-error');
    void el.offsetWidth; // restart the shake animation if it's already marked
    el.classList.add('field-error');
    el.addEventListener('input', function clear() {
      el.classList.remove('field-error');
      el.removeEventListener('input', clear);
    }, { once: true });
    if (!firstEl) firstEl = el;
  });
  if (firstEl) firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ---------------- Modal focus management ---------------- */

// Keyboard/screen-reader users land inside the dialog the moment it opens
// (rather than staying on whatever was focused behind it), and get their
// focus restored to the control that opened it once it closes.
let lastFocusedBeforeModal = null;
function focusModal(modalEl) {
  lastFocusedBeforeModal = document.activeElement;
  const target = modalEl.querySelector('[autofocus]') || modalEl.querySelector('input, select, textarea, button, [tabindex]');
  if (target) target.focus();
}
function restoreFocusAfterModal() {
  if (lastFocusedBeforeModal && document.body.contains(lastFocusedBeforeModal)) lastFocusedBeforeModal.focus();
  lastFocusedBeforeModal = null;
}

/* ---------------- Confirm modal ---------------- */

function confirmDialog(text, onConfirm) {
  $('#confirm-modal-text').textContent = text;
  confirmAction = onConfirm;
  $('#confirm-modal').hidden = false;
  focusModal($('#confirm-modal'));
}
function closeConfirmModal() {
  $('#confirm-modal').hidden = true;
  confirmAction = null;
  restoreFocusAfterModal();
}

/* ---------------- Tabs / routing ---------------- */

const TAB_TITLES = {
  dashboard: 'Dashboard', seasons: 'Seasons', totals: 'Career Totals',
  trophies: 'Trophy Cabinet', transfers: 'Transfers', settings: 'Settings',
  'p-dashboard': 'Dashboard', 'p-seasons': 'Seasons', 'p-totals': 'Career Totals',
  'p-honours': 'Trophy Cabinet', 'p-international': 'International', 'p-settings': 'Settings'
};

function switchTab(tab) {
  currentTab = tab;
  $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.view').forEach(v => v.classList.remove('active'));
  const view = $('#view-' + tab);
  if (view) view.classList.add('active');
  $('#sidebar').classList.remove('open');
  $('#sidebar-backdrop').classList.remove('open');
  $('#page-title').textContent = TAB_TITLES[tab] || 'FC Career Tracker';
  renderCurrentTab();
  $('#app-main').scrollTop = 0;
  window.scrollTo({ top: 0 });
}

function switchMode(mode) {
  if (mode === appSettings.mode) return;
  appSettings.mode = mode;
  saveAppSettings();
  document.documentElement.setAttribute('data-app-mode', mode);
  $$('.mode-switch-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  switchTab(mode === 'player' ? 'p-dashboard' : 'dashboard');
}

function renderCurrentTab() {
  if (currentTab === 'dashboard') renderDashboard();
  else if (currentTab === 'seasons') renderSeasons();
  else if (currentTab === 'totals') renderTotals();
  else if (currentTab === 'trophies') renderTrophies();
  else if (currentTab === 'transfers') renderTransfers();
  else if (currentTab === 'settings') renderSettings();
  else if (currentTab === 'p-dashboard') renderPlayerDashboard();
  else if (currentTab === 'p-seasons') renderPlayerSeasons();
  else if (currentTab === 'p-totals') renderPlayerTotals();
  else if (currentTab === 'p-honours') renderPlayerHonours();
  else if (currentTab === 'p-international') renderPlayerInternational();
  else if (currentTab === 'p-settings') renderPlayerSettings();
  updateHeaderSubtitle();
}

function updateHeaderSubtitle() {
  const subEl = $('#manager-subtitle');
  const nameEl = $('#manager-mini-name');
  const avatarEl = $('#manager-avatar');
  const mode = appSettings.mode;
  const active = mode === 'player' ? pState : state;
  const profileName = mode === 'player' ? active.player.name : active.manager.name;
  const displayName = saveDisplayName(mode, active);
  const totals = mode === 'player' ? computePlayerCareerTotals() : computeCareerTotals();

  nameEl.textContent = displayName;
  avatarEl.textContent = (profileName || displayName || '?').trim().slice(0, 2).toUpperCase();

  if (!profileName && !active.seasons.length) {
    subEl.textContent = 'Tap to switch saves';
    return;
  }
  const parts = [];
  if (totals.totalSeasons) parts.push(totals.totalSeasons + ' season' + (totals.totalSeasons === 1 ? '' : 's'));
  if (totals.totalTrophies) parts.push(totals.totalTrophies + ' trophies');
  const latest = totals.seasonsChrono[totals.seasonsChrono.length - 1];
  if (latest) parts.push('at ' + (latest.club || '—'));
  subEl.textContent = parts.join(' · ') || 'Tap to switch saves';
}

/* ---------------- SVG charts ---------------- */

function svgLineChart(points, opts) {
  opts = opts || {};
  const w = opts.width || 640, h = opts.height || 220;
  const padL = 34, padR = 14, padT = 16, padB = 26;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  if (!points.length) return '<div class="empty-state" style="padding:30px;"><p>No data yet.</p></div>';

  const values = points.map(p => p.value);
  let min = Math.min(...values), max = Math.max(...values);
  if (opts.invertY) { const t = min; min = max; max = t; } // higher value = lower on chart (for league position)
  if (min === max) { min -= 1; max += 1; }
  const yFor = v => {
    const t = (v - min) / (max - min || 1);
    return padT + (opts.invertY ? t : (1 - t)) * innerH;
  };
  const xFor = i => padL + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);

  const linePts = points.map((p, i) => `${xFor(i)},${yFor(p.value)}`).join(' ');
  const areaPts = `${xFor(0)},${padT + innerH} ` + linePts + ` ${xFor(points.length - 1)},${padT + innerH}`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(t => {
    const y = padT + t * innerH;
    return `<line class="grid-line" x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}"/>`;
  }).join('');

  const dots = points.map((p, i) => {
    const x = xFor(i), y = yFor(p.value);
    return `<circle class="data-dot" cx="${x}" cy="${y}" r="4" fill="${opts.color || 'var(--accent)'}"><title>${esc(p.label)}: ${esc(p.display !== undefined ? p.display : p.value)}</title></circle>`;
  }).join('');

  const xLabels = points.map((p, i) => {
    if (points.length > 10 && i % Math.ceil(points.length / 8) !== 0 && i !== points.length - 1) return '';
    return `<text class="axis-label" x="${xFor(i)}" y="${h - 6}" text-anchor="middle">${esc(p.label)}</text>`;
  }).join('');

  return `<svg class="svg-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
    ${gridLines}
    <polygon class="area-path" points="${areaPts}" fill="${opts.color || 'var(--accent)'}"></polygon>
    <polyline class="line-path" points="${linePts}" stroke="${opts.color || 'var(--accent)'}"></polyline>
    ${dots}
    ${xLabels}
  </svg>`;
}

function svgBarChart(groups, opts) {
  opts = opts || {};
  const w = opts.width || 640, h = opts.height || 220;
  const padL = 34, padR = 14, padT = 16, padB = 26;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  if (!groups.length) return '<div class="empty-state" style="padding:30px;"><p>No data yet.</p></div>';

  const allVals = groups.flatMap(g => g.values);
  const max = Math.max(1, ...allVals);
  const groupW = innerW / groups.length;
  const barsPerGroup = groups[0].values.length;
  const barW = Math.min(22, (groupW * 0.6) / barsPerGroup);

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(t => {
    const y = padT + t * innerH;
    return `<line class="grid-line" x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}"/>`;
  }).join('');

  let bars = '';
  groups.forEach((g, gi) => {
    const gx = padL + gi * groupW + groupW / 2 - (barW * barsPerGroup) / 2;
    g.values.forEach((v, vi) => {
      const bh = (v / max) * innerH;
      const x = gx + vi * barW;
      const y = padT + innerH - bh;
      bars += `<rect class="bar" x="${x}" y="${y}" width="${barW - 3}" height="${Math.max(bh,1)}" fill="${(opts.colors && opts.colors[vi]) || 'var(--accent)'}"><title>${esc(g.label)} — ${esc((opts.series && opts.series[vi]) || '')}: ${v}</title></rect>`;
    });
  });

  const xLabels = groups.map((g, i) => {
    if (groups.length > 10 && i % Math.ceil(groups.length / 8) !== 0 && i !== groups.length - 1) return '';
    return `<text class="axis-label" x="${padL + i * groupW + groupW / 2}" y="${h - 6}" text-anchor="middle">${esc(g.label)}</text>`;
  }).join('');

  return `<svg class="svg-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
    ${gridLines}${bars}${xLabels}
  </svg>`;
}

// Growing-window rolling average — the first point is just itself, the
// second is the average of the first two, and so on until the window
// fills, rather than leaving early seasons blank for lack of history.
function rollingAverage(values, window) {
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

// Multiple overlaid polylines sharing one set of axes — a single flat
// per-season line/bar chart (the existing svgLineChart/svgBarChart) doesn't
// make a long career's trend any easier to read than the raw table would;
// overlaying a rolling average does.
function svgMultiLineChart(labels, series, opts) {
  opts = opts || {};
  const w = opts.width || 640, h = opts.height || 220;
  const padL = 34, padR = 14, padT = 16, padB = 26;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  if (!labels.length) return '<div class="empty-state" style="padding:30px;"><p>No data yet.</p></div>';

  const allVals = series.flatMap(s => s.values);
  let min = Math.min(...allVals), max = Math.max(...allVals);
  if (min === max) { min -= 1; max += 1; }
  const yFor = v => padT + (1 - (v - min) / (max - min || 1)) * innerH;
  const xFor = i => padL + (labels.length === 1 ? innerW / 2 : (i / (labels.length - 1)) * innerW);

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(t => {
    const y = padT + t * innerH;
    return `<line class="grid-line" x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}"/>`;
  }).join('');

  const lines = series.map(s => {
    const pts = s.values.map((v, i) => `${xFor(i)},${yFor(v)}`).join(' ');
    return `<polyline class="line-path" points="${pts}" stroke="${s.color}"${s.dashed ? ' stroke-dasharray="6,5"' : ''}></polyline>`;
  }).join('');

  const dots = series.filter(s => !s.dashed).flatMap(s =>
    s.values.map((v, i) => `<circle class="data-dot" cx="${xFor(i)}" cy="${yFor(v)}" r="3.5" fill="${s.color}"><title>${esc(s.name)} · ${esc(labels[i])}: ${v.toFixed(1)}</title></circle>`)
  ).join('');

  const xLabels = labels.map((l, i) => {
    if (labels.length > 10 && i % Math.ceil(labels.length / 8) !== 0 && i !== labels.length - 1) return '';
    return `<text class="axis-label" x="${xFor(i)}" y="${h - 6}" text-anchor="middle">${esc(l)}</text>`;
  }).join('');

  const legend = series.map(s => `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:16px;"><span style="width:10px;height:10px;border-radius:50%;background:${s.color};display:inline-block;"></span>${esc(s.name)}</span>`).join('');

  return `<div style="font-size:12px;color:var(--text-dim);margin-bottom:8px;display:flex;flex-wrap:wrap;">${legend}</div>
  <svg class="svg-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
    ${gridLines}${lines}${dots}${xLabels}
  </svg>`;
}

/* ---------------- Dashboard ---------------- */

function renderDashboard() {
  const el = $('#dashboard-content');
  if (!state.seasons.length) {
    el.innerHTML = `
      <div class="empty-state card card-pad">
        <div class="empty-icon">⚽</div>
        <h3>Your career starts here</h3>
        <p>Add your first season to start tracking league results, cup runs, transfers, awards and more — every stat from your manager career mode, all in one place.</p>
        <button class="btn btn-primary" data-action="open-add-season">+ Add First Season</button>
      </div>`;
    return;
  }
  const t = computeCareerTotals();
  const latest = t.seasonsChrono[t.seasonsChrono.length - 1];
  const currency = appSettings.currency;

  const recent = t.seasonsChrono.slice(-5).reverse();
  const recentHtml = recent.map(s => {
    const L = s.league;
    return `<div class="season-card" data-action="edit-season" data-id="${s.id}" style="cursor:pointer;">
      <div class="season-card-main">
        <div class="season-card-title">${esc(s.seasonLabel)} <span class="season-card-club">${esc(s.club)}</span></div>
        <div class="season-card-meta">
          <span>${esc(s.divisionTier || '—')}</span>
          <span class="badge badge-position">${L.position ? ordinal(L.position) : '—'}</span>
          ${L.promoted ? '<span class="badge badge-promoted">Promoted</span>' : ''}
          ${L.relegated ? '<span class="badge badge-relegated">Relegated</span>' : ''}
        </div>
      </div>
      <div class="form-record">
        <span class="pill pill-w">${num(L.won)}W</span>
        <span class="pill pill-d">${num(L.drawn)}D</span>
        <span class="pill pill-l">${num(L.lost)}L</span>
      </div>
      <div class="season-card-trophies">${seasonTrophyList(s).map(tr => `<span class="trophy-chip">🏆 ${esc(tr.name)}</span>`).join('') || '<span class="hint">No trophies</span>'}</div>
    </div>`;
  }).join('');

  const posPoints = t.seasonsChrono.filter(s => s.league.position !== '').map(s => ({ label: s.seasonLabel, value: num(s.league.position), display: ordinal(s.league.position) }));
  const goalGroups = t.seasonsChrono.map(s => ({ label: s.seasonLabel, values: [num(s.league.gf), num(s.league.ga)] }));

  el.innerHTML = `
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-label">Seasons Managed</div><div class="stat-value">${t.totalSeasons}</div><div class="stat-sub">${t.totalClubs} club${t.totalClubs === 1 ? '' : 's'}</div></div>
      <div class="stat-tile"><div class="stat-label">Overall Record</div><div class="stat-value">${t.matches.won}-${t.matches.drawn}-${t.matches.lost}</div><div class="stat-sub">${fmtPct(t.winPct)} win rate</div></div>
      <div class="stat-tile"><div class="stat-label">Goal Difference</div><div class="stat-value">${t.goalDiff > 0 ? '+' : ''}${t.goalDiff}</div><div class="stat-sub">${t.matches.gf} for · ${t.matches.ga} against</div></div>
      <div class="stat-tile"><div class="stat-label">Trophies Won</div><div class="stat-value">${t.totalTrophies}</div><div class="stat-sub">${t.promotions} promotion${t.promotions === 1 ? '' : 's'}</div></div>
      <div class="stat-tile"><div class="stat-label">Net Transfer Spend</div><div class="stat-value">${fmtM(t.finances.net, currency)}</div><div class="stat-sub">${fmtM(t.finances.spend, currency)} spent</div></div>
      <div class="stat-tile"><div class="stat-label">Avg. League Position</div><div class="stat-value">${t.avgPosition ? ordinal(Math.round(t.avgPosition)) : '—'}</div><div class="stat-sub">across career</div></div>
    </div>

    <div class="dash-grid">
      <div class="card chart-card">
        <div class="chart-title">League Position by Season</div>
        ${svgLineChart(posPoints, { invertY: true, color: 'var(--accent-2)' })}
      </div>
      <div class="card card-pad">
        <div class="chart-title">Current Club</div>
        ${latest ? `
          <h3 style="font-size:20px;margin-bottom:4px;">${esc(latest.club)}</h3>
          <p class="hint" style="margin-bottom:14px;">${esc(latest.divisionTier || '')} · ${esc(latest.seasonLabel)}</p>
          <div style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-dim);margin-bottom:6px;"><span>Job Security</span><b style="color:var(--text)">${num(latest.managerStanding.jobSecurity)}%</b></div>
            <div class="progress-bar"><div class="progress-bar-fill" style="width:${clamp(num(latest.managerStanding.jobSecurity), 0, 100)}%"></div></div>
          </div>
          <p class="hint">Reputation: ${'⭐'.repeat(clamp(num(latest.managerStanding.reputationStars) || 0, 0, 5))}${'☆'.repeat(5 - clamp(num(latest.managerStanding.reputationStars) || 0, 0, 5))}</p>
        ` : '<p class="hint">No seasons yet.</p>'}
      </div>
    </div>

    <div class="card chart-card" style="margin-top:16px;">
      <div class="chart-title">Goals For vs Against by Season</div>
      ${svgBarChart(goalGroups, { colors: ['var(--accent)', 'var(--danger)'], series: ['Goals For', 'Goals Against'] })}
    </div>

    <div class="section-title">Recent Seasons</div>
    <div class="seasons-list">${recentHtml}</div>
  `;
}

// A quick "form guide" strip (last up to 8 results) from the optional match
// log — skipped entirely for seasons with no logged matches, since most
// seasons will only ever have the aggregate League Record.
function recentFormHTML(matches) {
  if (!matches || !matches.length) return '';
  const chips = matches.slice(-8).map(m => {
    const r = matchResult(m.gf, m.ga);
    return r ? `<span class="form-chip form-chip-${r.toLowerCase()}">${r}</span>` : '';
  }).join('');
  return chips ? `<div class="season-card-form"><span class="hint">Form</span>${chips}</div>` : '';
}

/* ---------------- Seasons list ---------------- */

function renderSeasons() {
  const listEl = $('#seasons-list');
  const q = ($('#season-search').value || '').toLowerCase().trim();
  const sort = $('#season-sort').value;

  let seasons = sortedSeasons(state.seasons, sort === 'newest' ? 'newest' : sort);
  if (q) {
    seasons = seasons.filter(s => {
      const hay = [s.club, s.seasonLabel, s.divisionTier, s.country, ...(s.competitions || []).map(c => c.name)].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  if (!state.seasons.length) {
    listEl.innerHTML = `<div class="empty-state card card-pad">
      <div class="empty-icon">📋</div>
      <h3>No seasons yet</h3>
      <p>Add a season to start logging your league campaign, cup runs, transfers and awards.</p>
      <button class="btn btn-primary" data-action="open-add-season">+ Add Season</button>
    </div>`;
    return;
  }
  if (!seasons.length) {
    listEl.innerHTML = `<div class="empty-state card card-pad"><p>No seasons match "${esc(q)}".</p></div>`;
    return;
  }

  listEl.innerHTML = seasons.map(s => {
    const L = s.league;
    const trophies = seasonTrophyList(s);
    return `<div class="season-card" data-action="edit-season" data-id="${s.id}">
      <div class="season-card-main">
        <div class="season-card-title">${esc(s.seasonLabel)} <span class="season-card-club">${esc(s.club)}</span></div>
        <div class="season-card-meta">
          <span>${esc(s.divisionTier || '—')}</span>
          <span class="badge badge-position">${L.position ? ordinal(L.position) + (L.leagueSize ? ' / ' + L.leagueSize : '') : 'Position —'}</span>
          ${L.promoted ? '<span class="badge badge-promoted">Promoted</span>' : ''}
          ${L.relegated ? '<span class="badge badge-relegated">Relegated</span>' : ''}
          ${L.playoff ? '<span class="badge badge-position">Playoffs</span>' : ''}
        </div>
      </div>
      <div class="form-record">
        <span class="pill pill-w">${num(L.won)}W</span>
        <span class="pill pill-d">${num(L.drawn)}D</span>
        <span class="pill pill-l">${num(L.lost)}L</span>
      </div>
      ${recentFormHTML(s.matches)}
      <div class="season-card-trophies">${trophies.map(tr => `<span class="trophy-chip">🏆 ${esc(tr.name)}</span>`).join('') || '<span class="hint">No trophies</span>'}</div>
      <div class="season-card-actions">
        <button class="btn btn-ghost btn-sm btn-icon" data-action="edit-season" data-id="${s.id}" title="Edit" aria-label="Edit season">✎</button>
        <button class="btn btn-ghost btn-sm btn-icon" data-action="duplicate-season" data-id="${s.id}" title="Start next season from this one" aria-label="Duplicate season as template">⧉</button>
        <button class="btn btn-ghost btn-sm btn-icon" data-action="delete-season" data-id="${s.id}" title="Delete" aria-label="Delete season">🗑</button>
      </div>
    </div>`;
  }).join('');
}

/* ---------------- Career totals tab ---------------- */

function renderTotals() {
  const el = $('#totals-content');
  if (!state.seasons.length) {
    el.innerHTML = `<div class="empty-state card card-pad"><div class="empty-icon">📊</div><h3>No career data yet</h3><p>Add seasons to see your full career totals here.</p></div>`;
    return;
  }
  const t = computeCareerTotals();
  const currency = appSettings.currency;
  const recordsHtml = recordsSectionHtml(computeCareerRecords(t.seasonsChrono));

  let trendHtml = '';
  if (t.seasonsChrono.length >= 2) {
    const labels = t.seasonsChrono.map(s => s.seasonLabel);
    const winRates = t.seasonsChrono.map(s => winPct(num(s.league.won), num(s.league.drawn), num(s.league.lost)));
    trendHtml = `
    <div class="section-title">Win Rate Trend</div>
    <div class="card card-pad">
      ${svgMultiLineChart(labels, [
        { name: 'Season Win Rate', color: 'var(--accent-2)', values: winRates },
        { name: '3-Season Rolling Avg', color: 'var(--accent)', values: rollingAverage(winRates, 3), dashed: true }
      ])}
    </div>`;
  }

  const trophyRows = Object.entries(t.trophiesByName).sort((a, b) => b[1].count - a[1].count).map(([name, d]) =>
    `<tr><td>${esc(name)}</td><td>${d.count}</td><td>${d.entries.map(e => `${esc(e.season)} (${esc(e.club)})`).join(', ')}</td></tr>`
  ).join('') || `<tr><td colspan="3" class="hint">No trophies yet</td></tr>`;

  const clubRows = t.clubHistory.map(c => `
    <div class="club-history-row">
      <div>
        <div class="club-history-name">${esc(c.club)}</div>
        <div class="club-history-range">${esc(c.first)} – ${esc(c.last)} · ${c.seasonCount} season${c.seasonCount === 1 ? '' : 's'}</div>
      </div>
      <div class="club-history-stats">
        <span><b>${c.won}-${c.drawn}-${c.lost}</b></span>
        <span><b>${fmtPct(c.winPct)}</b> win rate</span>
        <span><b>${c.trophies}</b> trophies</span>
      </div>
    </div>`).join('');

  el.innerHTML = `

    <div class="section-title">Overall Record (League + Cups)</div>
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-label">Matches Played</div><div class="stat-value">${fmtNum(t.matches.played)}</div></div>
      <div class="stat-tile"><div class="stat-label">Won</div><div class="stat-value">${fmtNum(t.matches.won)}</div></div>
      <div class="stat-tile"><div class="stat-label">Drawn</div><div class="stat-value">${fmtNum(t.matches.drawn)}</div></div>
      <div class="stat-tile"><div class="stat-label">Lost</div><div class="stat-value">${fmtNum(t.matches.lost)}</div></div>
      <div class="stat-tile"><div class="stat-label">Win Rate</div><div class="stat-value">${fmtPct(t.winPct)}</div></div>
      <div class="stat-tile"><div class="stat-label">Goals For</div><div class="stat-value">${fmtNum(t.matches.gf)}</div></div>
      <div class="stat-tile"><div class="stat-label">Goals Against</div><div class="stat-value">${fmtNum(t.matches.ga)}</div></div>
      <div class="stat-tile"><div class="stat-label">Goal Difference</div><div class="stat-value">${t.goalDiff > 0 ? '+' : ''}${t.goalDiff}</div></div>
    </div>

    ${trendHtml}

    <div class="section-title">League-Only Record</div>
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-label">League Played</div><div class="stat-value">${fmtNum(t.leagueOnly.played)}</div></div>
      <div class="stat-tile"><div class="stat-label">League Win Rate</div><div class="stat-value">${fmtPct(t.leagueWinPct)}</div></div>
      <div class="stat-tile"><div class="stat-label">Avg. Position</div><div class="stat-value">${t.avgPosition ? ordinal(Math.round(t.avgPosition)) : '—'}</div></div>
      <div class="stat-tile"><div class="stat-label">Promotions</div><div class="stat-value">${t.promotions}</div></div>
      <div class="stat-tile"><div class="stat-label">Relegations</div><div class="stat-value">${t.relegations}</div></div>
      <div class="stat-tile"><div class="stat-label">Playoff Appearances</div><div class="stat-value">${t.playoffs}</div></div>
    </div>

    <div class="section-title">Trophies &amp; Awards</div>
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-label">Total Trophies</div><div class="stat-value">${t.totalTrophies}</div></div>
      <div class="stat-tile"><div class="stat-label">Manager of the Season</div><div class="stat-value">${t.awards.motsWins}</div></div>
      <div class="stat-tile"><div class="stat-label">Manager of the Month (total)</div><div class="stat-value">${t.awards.motmTotal}</div></div>
      <div class="stat-tile"><div class="stat-label">Golden Boot Seasons</div><div class="stat-value">${t.awards.goldenBoot}</div></div>
      <div class="stat-tile"><div class="stat-label">Golden Glove Seasons</div><div class="stat-value">${t.awards.goldenGlove}</div></div>
      <div class="stat-tile"><div class="stat-label">Player of the Season (club)</div><div class="stat-value">${t.awards.potsCount}</div></div>
      <div class="stat-tile"><div class="stat-label">Young Player of the Season</div><div class="stat-value">${t.awards.yotsCount}</div></div>
    </div>

    <div class="section-title">Finances</div>
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-label">Total Spent</div><div class="stat-value">${fmtM(t.finances.spend, currency)}</div><div class="stat-sub">${t.finances.transfersInCount} signings</div></div>
      <div class="stat-tile"><div class="stat-label">Total Income</div><div class="stat-value">${fmtM(t.finances.income, currency)}</div><div class="stat-sub">${t.finances.transfersOutCount} sales</div></div>
      <div class="stat-tile"><div class="stat-label">Net Spend</div><div class="stat-value">${fmtM(t.finances.net, currency)}</div></div>
      <div class="stat-tile"><div class="stat-label">Total Prize Money</div><div class="stat-value">${fmtM(t.finances.prizeMoneyTotal, currency)}</div></div>
    </div>

    ${t.bestSeason ? `
    <div class="section-title">Best Season</div>
    <div class="card card-pad">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div>
          <h3 style="font-size:17px;">${esc(t.bestSeason.seasonLabel)} — ${esc(t.bestSeason.club)}</h3>
          <p class="hint" style="margin-top:4px;">${esc(t.bestSeason.divisionTier || '')} · Finished ${t.bestSeason.league.position ? ordinal(t.bestSeason.league.position) : '—'}</p>
        </div>
        <div class="season-card-trophies">${seasonTrophyList(t.bestSeason).map(tr => `<span class="trophy-chip">🏆 ${esc(tr.name)}</span>`).join('') || '<span class="hint">No trophies</span>'}</div>
      </div>
    </div>` : ''}

    ${recordsHtml}

    <div class="section-title">Trophy Breakdown</div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Competition</th><th>Times Won</th><th>Seasons</th></tr></thead>
        <tbody>${trophyRows}</tbody>
      </table>
    </div>

    <div class="section-title">Club History</div>
    <div class="club-history">${clubRows}</div>
  `;
}

/* ---------------- Trophy cabinet ---------------- */

function trophy3dType(competitionType) {
  if (competitionType === 'League') return 'crown';
  if (['Champions League', 'Club World Cup', 'Other Continental Cup', 'Europa League', 'Conference League'].includes(competitionType)) return 'continental';
  if (competitionType === 'Domestic Super Cup') return 'shield';
  return 'cup'; // Domestic Cup, League Cup, Other
}

function trophy3dTier(type) {
  if (type === 'crown' || type === 'continental' || type === 'medal') return 'gold';
  if (type === 'cup') return 'silver';
  return 'bronze';
}

function mountTrophy3dWhenReady(key, container, type, tier) {
  if (!container) return;
  if (window.Trophy3D) window.Trophy3D.mountTrophy(key, container, type, tier);
  else window.addEventListener('trophy3d-ready', () => window.Trophy3D.mountTrophy(key, container, type, tier), { once: true });
}

function renderTrophies() {
  const el = $('#trophies-content');
  const t = computeCareerTotals();
  const entries = Object.entries(t.trophiesByName).sort((a, b) => b[1].count - a[1].count);

  if (window.Trophy3D) window.Trophy3D.unmountAll();

  el.innerHTML = `
    <div class="view-header">
      <div class="hint">${t.totalTrophies} ${t.totalTrophies === 1 ? 'trophy' : 'trophies'} won across ${t.totalSeasons} season${t.totalSeasons === 1 ? '' : 's'} · drag a trophy to spin it</div>
    </div>
    ${entries.length ? `<div class="trophy-grid">
      ${entries.map(([name, d], i) => `
        <div class="trophy-card">
          <div class="trophy3d-slot" id="trophy3d-m-${i}">
            <span class="trophy-card-count">×${d.count}</span>
            <span class="trophy3d-hint">Drag to rotate</span>
          </div>
          <div class="trophy-card-info">
            <div class="trophy-name">${esc(name)}</div>
            <div class="trophy-list-detail">${d.entries.map(e => `${esc(e.season)} (${esc(e.club)})`).join('<br>')}</div>
          </div>
        </div>`).join('')}
    </div>` : `<div class="empty-state card card-pad"><div class="empty-icon">🏆</div><h3>Trophy cabinet is empty</h3><p>Win a league title or cup and it'll show up here.</p></div>`}
  `;

  entries.forEach(([name, d], i) => {
    const type = trophy3dType(d.type);
    mountTrophy3dWhenReady('m-' + i, document.getElementById('trophy3d-m-' + i), type, trophy3dTier(type));
  });
}

/* ---------------- Transfers tab ---------------- */

function renderTransfers() {
  const el = $('#transfers-content');
  const seasons = sortedSeasons(state.seasons, 'newest');
  const currency = appSettings.currency;

  let rows = [];
  seasons.forEach(s => {
    (s.transfersIn || []).forEach(tr => rows.push(Object.assign({}, tr, { season: s.seasonLabel, myClub: s.club, dir: 'In', counterparty: tr.club })));
    (s.transfersOut || []).forEach(tr => rows.push(Object.assign({}, tr, { season: s.seasonLabel, myClub: s.club, dir: 'Out', counterparty: tr.club })));
  });

  if (!rows.length) {
    el.innerHTML = `<div class="empty-state card card-pad"><div class="empty-icon">🔄</div><h3>No transfers logged</h3><p>Add signings and sales inside a season's transfer sections.</p></div>`;
    return;
  }

  const totalIn = rows.filter(r => r.dir === 'In').reduce((a, r) => a + num(r.fee), 0);
  const totalOut = rows.filter(r => r.dir === 'Out').reduce((a, r) => a + num(r.fee), 0);

  const tableRows = rows.map(r => `
    <tr>
      <td>${esc(r.season)}</td>
      <td>${esc(r.myClub)}</td>
      <td>${r.dir === 'In' ? '⬇️ In' : '⬆️ Out'}</td>
      <td>${esc(r.name) || '—'}</td>
      <td>${esc(r.position) || '—'}</td>
      <td>${esc(r.type) || '—'}</td>
      <td>${esc(r.counterparty) || '—'}</td>
      <td class="${r.dir === 'In' ? 'amount-out' : 'amount-in'}">${fmtM(r.fee, currency)}</td>
    </tr>`).join('');

  el.innerHTML = `
    <div class="stat-grid" style="margin-bottom:18px;">
      <div class="stat-tile"><div class="stat-label">Total Spent</div><div class="stat-value">${fmtM(totalIn, currency)}</div></div>
      <div class="stat-tile"><div class="stat-label">Total Received</div><div class="stat-value">${fmtM(totalOut, currency)}</div></div>
      <div class="stat-tile"><div class="stat-label">Net Spend</div><div class="stat-value">${fmtM(totalIn - totalOut, currency)}</div></div>
      <div class="stat-tile"><div class="stat-label">Total Deals</div><div class="stat-value">${rows.length}</div></div>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Season</th><th>Club</th><th>Direction</th><th>Player</th><th>Position</th><th>Type</th><th>Counterparty</th><th>Fee</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  `;
}

/* ---------------- Settings tab ---------------- */

function renderSettings() {
  const el = $('#settings-content');
  const m = state.manager, s = appSettings;
  el.innerHTML = `
    <details class="form-section settings-block" open>
      <summary><span class="legend-icon">👤</span> Manager Profile</summary>
      <div class="form-section-body">
      <div class="form-grid cols-2">
        <div class="field"><label>Manager Name</label><input class="input" id="f-mgr-name" value="${esc(m.name)}" placeholder="e.g. Alex Morgan" /></div>
        <div class="field"><label>Nationality</label><input class="input" id="f-mgr-nat" value="${esc(m.nationality)}" placeholder="e.g. England" /></div>
        <div class="field"><label>Starting Club</label><input class="input" id="f-mgr-club" value="${esc(m.startingClub)}" placeholder="e.g. Lower League FC" /></div>
        <div class="field"><label>Career Start Year</label><input class="input" id="f-mgr-year" value="${esc(m.careerStartYear)}" placeholder="e.g. 2026" /></div>
      </div>
      <button class="btn btn-primary btn-sm" style="margin-top:14px;" data-action="save-profile">Save Profile</button>
      </div>
    </details>

    <div class="settings-block">
      <div class="settings-row install-app-row" ${deferredInstallPrompt ? '' : 'hidden'}>
        <div class="settings-row-text"><h4>Install App</h4><p>Add FC Career Tracker to your device as a standalone app.</p></div>
        <button class="btn btn-primary install-app-btn">Install</button>
      </div>
      <div class="settings-row">
        <div class="settings-row-text"><h4>Theme</h4><p>Choose how the tracker looks.</p></div>
        <div class="theme-toggle" id="theme-toggle">
          <button data-theme="dark" class="${s.theme === 'dark' ? 'active' : ''}">Dark</button>
          <button data-theme="light" class="${s.theme === 'light' ? 'active' : ''}">Light</button>
          <button data-theme="system" class="${s.theme === 'system' ? 'active' : ''}">System</button>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-text"><h4>Layout</h4><p>Switch to a touch-friendly mobile layout with a bottom tab bar, or use the full desktop layout.</p></div>
        <div class="layout-toggle">
          <button data-layout="desktop" class="${s.layout === 'mobile' ? '' : 'active'}">Desktop</button>
          <button data-layout="mobile" class="${s.layout === 'mobile' ? 'active' : ''}">Mobile</button>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-text"><h4>Currency</h4><p>Used for transfer fees, budgets and prize money.</p></div>
        <select class="input select currency-select" id="f-currency" style="width:120px;">
          <option value="£" ${s.currency === '£' ? 'selected' : ''}>£ GBP</option>
          <option value="€" ${s.currency === '€' ? 'selected' : ''}>€ EUR</option>
          <option value="$" ${s.currency === '$' ? 'selected' : ''}>$ USD</option>
        </select>
      </div>
      <div class="settings-row">
        <div class="settings-row-text"><h4>Trophy Render Quality</h4><p>Auto sharpens trophies on any screen; Low favors performance on older devices.</p></div>
        <div class="quality-toggle">
          <button data-quality="low" class="${s.renderQuality === 'low' ? 'active' : ''}">Low</button>
          <button data-quality="auto" class="${s.renderQuality === 'high' ? '' : 'active'}">Auto</button>
          <button data-quality="high" class="${s.renderQuality === 'high' ? 'active' : ''}">High</button>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-text"><h4>Export Data</h4><p>${backupStatusLine()} Everything here lives only in this browser — export a copy so a clear-cache or reinstall can't lose it.</p></div>
        <button class="btn btn-ghost" data-action="export-json">Export JSON</button>
      </div>
      <div class="settings-row">
        <div class="settings-row-text"><h4>Import Data</h4><p>Restore this save from a previously exported JSON backup. This replaces its current data.</p></div>
        <label class="btn btn-ghost" style="cursor:pointer;">Import JSON<input type="file" class="import-file-input" accept="application/json" style="display:none;" /></label>
      </div>
      ${transferCodeSettingsHTML()}
      <div class="settings-row">
        <div class="settings-row-text"><h4>Reset This Save</h4><p>Permanently clear the manager profile and every season in this save. Cannot be undone.</p></div>
        <button class="btn btn-danger" data-action="reset-all">Reset This Save</button>
      </div>
    </div>
  `;
}

/* ================= PLAYER MODE VIEWS ================= */

function renderPlayerDashboard() {
  const el = $('#p-dashboard-content');
  if (!pState.seasons.length) {
    el.innerHTML = `
      <div class="empty-state card card-pad">
        <div class="empty-icon">⚽</div>
        <h3>Your playing career starts here</h3>
        <p>Add your first season to start tracking appearances, goals, assists, ratings, awards and international caps — every stat from your player career mode.</p>
        <button class="btn btn-primary" data-action="open-add-player-season">+ Add First Season</button>
      </div>`;
    return;
  }
  const t = computePlayerCareerTotals();
  const latest = t.seasonsChrono[t.seasonsChrono.length - 1];
  const currency = appSettings.currency;

  const recent = t.seasonsChrono.slice(-5).reverse();
  const recentHtml = recent.map(s => {
    const trophies = playerSeasonTrophyList(s);
    return `<div class="season-card" data-action="edit-player-season" data-id="${s.id}" style="cursor:pointer;">
      <div class="season-card-main">
        <div class="season-card-title">${esc(s.seasonLabel)} <span class="season-card-club">${esc(s.club)}</span></div>
        <div class="season-card-meta">
          <span>${esc(s.divisionTier || '—')}</span>
          ${s.ratings.overallEnd ? `<span class="badge badge-position">OVR ${esc(s.ratings.overallEnd)}</span>` : ''}
        </div>
      </div>
      <div class="form-record">
        <span class="pill pill-w">${num(s.attack.goals)}G</span>
        <span class="pill pill-d">${num(s.attack.assists)}A</span>
        <span class="pill pill-l">${num(s.appearances.played)} apps</span>
      </div>
      <div class="season-card-trophies">${trophies.map(tr => `<span class="trophy-chip">🏆 ${esc(tr.name)}</span>`).join('') || '<span class="hint">No trophies</span>'}</div>
    </div>`;
  }).join('');

  const ratingPoints = t.seasonsChrono.filter(s => s.ratings.overallEnd !== '').map(s => ({ label: s.seasonLabel, value: num(s.ratings.overallEnd) }));
  const contribGroups = t.seasonsChrono.map(s => ({ label: s.seasonLabel, values: [num(s.attack.goals), num(s.attack.assists)] }));

  el.innerHTML = `
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-label">Seasons Played</div><div class="stat-value">${t.totalSeasons}</div><div class="stat-sub">${t.totalClubs} club${t.totalClubs === 1 ? '' : 's'}</div></div>
      <div class="stat-tile"><div class="stat-label">Appearances</div><div class="stat-value">${fmtNum(t.appearances.played)}</div><div class="stat-sub">${fmtNum(t.appearances.minutes)} minutes</div></div>
      <div class="stat-tile"><div class="stat-label">Goals + Assists</div><div class="stat-value">${fmtNum(t.goalContributions)}</div><div class="stat-sub">${fmtNum(t.attack.goals)}G ${fmtNum(t.attack.assists)}A</div></div>
      <div class="stat-tile"><div class="stat-label">Trophies Won</div><div class="stat-value">${t.totalTrophies}</div><div class="stat-sub">${t.awards.potsClub} POTS award${t.awards.potsClub === 1 ? '' : 's'}</div></div>
      <div class="stat-tile"><div class="stat-label">Avg. Match Rating</div><div class="stat-value">${t.avgRating ? t.avgRating.toFixed(2) : '—'}</div><div class="stat-sub">${t.motmTotal} MOTM</div></div>
      <div class="stat-tile"><div class="stat-label">International Caps</div><div class="stat-value">${t.intl.caps}</div><div class="stat-sub">${t.intl.goals} goals</div></div>
    </div>

    <div class="dash-grid">
      <div class="card chart-card">
        <div class="chart-title">Overall Rating by Season</div>
        ${svgLineChart(ratingPoints, { color: 'var(--accent-2)' })}
      </div>
      <div class="card card-pad">
        <div class="chart-title">Current Club</div>
        ${latest ? `
          <h3 style="font-size:20px;margin-bottom:4px;">${esc(latest.club)}</h3>
          <p class="hint" style="margin-bottom:14px;">${esc(latest.divisionTier || '')} · ${esc(latest.seasonLabel)}${latest.shirtNumber ? ' · #' + esc(latest.shirtNumber) : ''}</p>
          ${latest.ratings.overallEnd ? `
          <div style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-dim);margin-bottom:6px;"><span>Overall Rating</span><b style="color:var(--text)">${esc(latest.ratings.overallEnd)}</b></div>
            <div class="progress-bar"><div class="progress-bar-fill" style="width:${clamp(num(latest.ratings.overallEnd), 0, 99)}%"></div></div>
          </div>` : ''}
          <p class="hint">Potential: ${esc(latest.ratings.potential) || '—'} · Skill Moves: ${'⭐'.repeat(clamp(num(latest.ratings.skillMoves) || 0, 0, 5))}</p>
        ` : '<p class="hint">No seasons yet.</p>'}
      </div>
    </div>

    <div class="card chart-card" style="margin-top:16px;">
      <div class="chart-title">Goals vs Assists by Season</div>
      ${svgBarChart(contribGroups, { colors: ['var(--accent)', 'var(--accent-2)'], series: ['Goals', 'Assists'] })}
    </div>

    <div class="section-title">Recent Seasons</div>
    <div class="seasons-list">${recentHtml}</div>
  `;
}

function renderPlayerSeasons() {
  const listEl = $('#p-seasons-list');
  const q = ($('#p-season-search').value || '').toLowerCase().trim();
  const sort = $('#p-season-sort').value;

  let seasons = playerSortedSeasons(pState.seasons, sort);
  if (q) {
    seasons = seasons.filter(s => {
      const hay = [s.club, s.seasonLabel, s.divisionTier, s.country, ...(s.competitions || []).map(c => c.name)].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  if (!pState.seasons.length) {
    listEl.innerHTML = `<div class="empty-state card card-pad">
      <div class="empty-icon">📋</div>
      <h3>No seasons yet</h3>
      <p>Add a season to start logging appearances, goals, assists and awards.</p>
      <button class="btn btn-primary" data-action="open-add-player-season">+ Add Season</button>
    </div>`;
    return;
  }
  if (!seasons.length) {
    listEl.innerHTML = `<div class="empty-state card card-pad"><p>No seasons match "${esc(q)}".</p></div>`;
    return;
  }

  listEl.innerHTML = seasons.map(s => {
    const trophies = playerSeasonTrophyList(s);
    return `<div class="season-card" data-action="edit-player-season" data-id="${s.id}">
      <div class="season-card-main">
        <div class="season-card-title">${esc(s.seasonLabel)} <span class="season-card-club">${esc(s.club)}</span></div>
        <div class="season-card-meta">
          <span>${esc(s.divisionTier || '—')}</span>
          ${s.ratings.overallEnd ? `<span class="badge badge-position">OVR ${esc(s.ratings.overallEnd)}</span>` : ''}
          ${s.transfer && s.transfer.moved ? '<span class="badge badge-position">Transferred</span>' : ''}
          ${s.international && s.international.calledUp ? '<span class="badge badge-promoted">Capped</span>' : ''}
        </div>
      </div>
      <div class="form-record">
        <span class="pill pill-w">${num(s.attack.goals)}G</span>
        <span class="pill pill-d">${num(s.attack.assists)}A</span>
        <span class="pill pill-l">${num(s.appearances.played)} apps</span>
      </div>
      ${recentFormHTML(s.matches)}
      <div class="season-card-trophies">${trophies.map(tr => `<span class="trophy-chip">🏆 ${esc(tr.name)}</span>`).join('') || '<span class="hint">No trophies</span>'}</div>
      <div class="season-card-actions">
        <button class="btn btn-ghost btn-sm btn-icon" data-action="edit-player-season" data-id="${s.id}" title="Edit" aria-label="Edit season">✎</button>
        <button class="btn btn-ghost btn-sm btn-icon" data-action="duplicate-player-season" data-id="${s.id}" title="Start next season from this one" aria-label="Duplicate season as template">⧉</button>
        <button class="btn btn-ghost btn-sm btn-icon" data-action="delete-player-season" data-id="${s.id}" title="Delete" aria-label="Delete season">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function renderPlayerTotals() {
  const el = $('#p-totals-content');
  if (!pState.seasons.length) {
    el.innerHTML = `<div class="empty-state card card-pad"><div class="empty-icon">📊</div><h3>No career data yet</h3><p>Add seasons to see your full career totals here.</p></div>`;
    return;
  }
  const t = computePlayerCareerTotals();
  const recordsHtml = recordsSectionHtml(playerCareerRecords(t.seasonsChrono));

  let trendHtml = '';
  if (t.seasonsChrono.length >= 2) {
    const labels = t.seasonsChrono.map(s => s.seasonLabel);
    const contributions = t.seasonsChrono.map(s => num(s.attack.goals) + num(s.attack.assists));
    trendHtml = `
    <div class="section-title">Goal Contribution Trend</div>
    <div class="card card-pad">
      ${svgMultiLineChart(labels, [
        { name: 'Goals + Assists', color: 'var(--accent-2)', values: contributions },
        { name: '3-Season Rolling Avg', color: 'var(--accent)', values: rollingAverage(contributions, 3), dashed: true }
      ])}
    </div>`;
  }

  const trophyRows = Object.entries(t.trophiesByName).sort((a, b) => b[1].count - a[1].count).map(([name, d]) =>
    `<tr><td>${esc(name)}</td><td>${d.count}</td><td>${d.entries.map(e => `${esc(e.season)} (${esc(e.club)})`).join(', ')}</td></tr>`
  ).join('') || `<tr><td colspan="3" class="hint">No trophies yet</td></tr>`;

  const clubRows = t.clubHistory.map(c => `
    <div class="club-history-row">
      <div>
        <div class="club-history-name">${esc(c.club)}</div>
        <div class="club-history-range">${esc(c.first)} – ${esc(c.last)} · ${c.seasonCount} season${c.seasonCount === 1 ? '' : 's'}</div>
      </div>
      <div class="club-history-stats">
        <span><b>${c.apps}</b> apps</span>
        <span><b>${c.goals}</b> goals</span>
        <span><b>${c.assists}</b> assists</span>
        <span><b>${c.trophies}</b> trophies</span>
      </div>
    </div>`).join('');

  el.innerHTML = `
    <div class="section-title">Career Output</div>
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-label">Appearances</div><div class="stat-value">${fmtNum(t.appearances.played)}</div></div>
      <div class="stat-tile"><div class="stat-label">Starts</div><div class="stat-value">${fmtNum(t.appearances.started)}</div></div>
      <div class="stat-tile"><div class="stat-label">Sub Appearances</div><div class="stat-value">${fmtNum(t.appearances.subApps)}</div></div>
      <div class="stat-tile"><div class="stat-label">Minutes Played</div><div class="stat-value">${fmtNum(t.appearances.minutes)}</div></div>
      <div class="stat-tile"><div class="stat-label">Goals</div><div class="stat-value">${fmtNum(t.attack.goals)}</div></div>
      <div class="stat-tile"><div class="stat-label">Assists</div><div class="stat-value">${fmtNum(t.attack.assists)}</div></div>
      <div class="stat-tile"><div class="stat-label">Goals per Game</div><div class="stat-value">${t.goalsPerGame.toFixed(2)}</div></div>
      <div class="stat-tile"><div class="stat-label">Avg. Match Rating</div><div class="stat-value">${t.avgRating ? t.avgRating.toFixed(2) : '—'}</div></div>
    </div>

    ${trendHtml}

    <div class="section-title">Shooting &amp; Creation</div>
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-label">Shots on Target</div><div class="stat-value">${fmtNum(t.attack.shotsOnTarget)}</div></div>
      <div class="stat-tile"><div class="stat-label">Total Shots</div><div class="stat-value">${fmtNum(t.attack.shotsTotal)}</div></div>
      <div class="stat-tile"><div class="stat-label">Key Passes</div><div class="stat-value">${fmtNum(t.attack.keyPasses)}</div></div>
      <div class="stat-tile"><div class="stat-label">Dribbles Completed</div><div class="stat-value">${fmtNum(t.attack.dribbles)}</div></div>
    </div>

    <div class="section-title">Defending, Goalkeeping &amp; Discipline</div>
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-label">Tackles</div><div class="stat-value">${fmtNum(t.defending.tackles)}</div></div>
      <div class="stat-tile"><div class="stat-label">Interceptions</div><div class="stat-value">${fmtNum(t.defending.interceptions)}</div></div>
      <div class="stat-tile"><div class="stat-label">Duels Won</div><div class="stat-value">${fmtNum(t.defending.duelsWon)}</div></div>
      <div class="stat-tile"><div class="stat-label">Goalkeeper Saves</div><div class="stat-value">${fmtNum(t.goalkeeping.saves)}</div></div>
      <div class="stat-tile"><div class="stat-label">Clean Sheets</div><div class="stat-value">${fmtNum(t.goalkeeping.cleanSheets)}</div></div>
      <div class="stat-tile"><div class="stat-label">Yellow Cards</div><div class="stat-value">${fmtNum(t.discipline.yellow)}</div></div>
      <div class="stat-tile"><div class="stat-label">Red Cards</div><div class="stat-value">${fmtNum(t.discipline.red)}</div></div>
      <div class="stat-tile"><div class="stat-label">Promotions</div><div class="stat-value">${t.promotions}</div></div>
    </div>

    <div class="section-title">Trophies &amp; Awards</div>
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-label">Total Trophies</div><div class="stat-value">${t.totalTrophies}</div></div>
      <div class="stat-tile"><div class="stat-label">Player of the Season</div><div class="stat-value">${t.awards.potsClub}</div></div>
      <div class="stat-tile"><div class="stat-label">Young Player of the Season</div><div class="stat-value">${t.awards.yotsClub}</div></div>
      <div class="stat-tile"><div class="stat-label">Team of the Season</div><div class="stat-value">${t.awards.teamOfSeason}</div></div>
      <div class="stat-tile"><div class="stat-label">Golden Boot Seasons</div><div class="stat-value">${t.awards.goldenBoot}</div></div>
      <div class="stat-tile"><div class="stat-label">Golden Glove Seasons</div><div class="stat-value">${t.awards.goldenGlove}</div></div>
    </div>

    ${t.bestSeason ? `
    <div class="section-title">Best Season</div>
    <div class="card card-pad">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div>
          <h3 style="font-size:17px;">${esc(t.bestSeason.seasonLabel)} — ${esc(t.bestSeason.club)}</h3>
          <p class="hint" style="margin-top:4px;">${num(t.bestSeason.attack.goals)} goals, ${num(t.bestSeason.attack.assists)} assists</p>
        </div>
        <div class="season-card-trophies">${playerSeasonTrophyList(t.bestSeason).map(tr => `<span class="trophy-chip">🏆 ${esc(tr.name)}</span>`).join('') || '<span class="hint">No trophies</span>'}</div>
      </div>
    </div>` : ''}

    ${recordsHtml}

    <div class="section-title">Trophy Breakdown</div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Competition</th><th>Times Won</th><th>Seasons</th></tr></thead>
        <tbody>${trophyRows}</tbody>
      </table>
    </div>

    <div class="section-title">Club History</div>
    <div class="club-history">${clubRows}</div>
  `;
}

function renderPlayerHonours() {
  const el = $('#p-honours-content');
  const t = computePlayerCareerTotals();
  const entries = Object.entries(t.trophiesByName).sort((a, b) => b[1].count - a[1].count);

  const individualCards = [
    { count: t.awards.potsClub, name: 'Club Player of the Season' },
    { count: t.awards.yotsClub, name: 'Young Player of the Season' },
    { count: t.awards.teamOfSeason, name: 'Team of the Season' },
    { count: t.awards.goldenBoot, name: 'Golden Boot' },
    { count: t.awards.goldenGlove, name: 'Golden Glove' }
  ].filter(a => a.count > 0);

  if (window.Trophy3D) window.Trophy3D.unmountAll();

  el.innerHTML = `
    <div class="view-header">
      <div class="hint">${t.totalTrophies} team ${t.totalTrophies === 1 ? 'trophy' : 'trophies'} · ${individualCards.reduce((a, c) => a + c.count, 0)} individual awards · drag a trophy to spin it</div>
    </div>

    <div class="section-title">Team Trophies</div>
    ${entries.length ? `<div class="trophy-grid">
      ${entries.map(([name, d], i) => `
        <div class="trophy-card">
          <div class="trophy3d-slot" id="trophy3d-p-${i}">
            <span class="trophy-card-count">×${d.count}</span>
            <span class="trophy3d-hint">Drag to rotate</span>
          </div>
          <div class="trophy-card-info">
            <div class="trophy-name">${esc(name)}</div>
            <div class="trophy-list-detail">${d.entries.map(e => `${esc(e.season)} (${esc(e.club)})`).join('<br>')}</div>
          </div>
        </div>`).join('')}
    </div>` : `<div class="empty-state card card-pad"><div class="empty-icon">🏆</div><h3>No team trophies yet</h3><p>Win a league title or cup with your club and it'll show up here.</p></div>`}

    <div class="section-title">Individual Awards</div>
    ${individualCards.length ? `<div class="trophy-grid">
      ${individualCards.map((a, i) => `
        <div class="trophy-card">
          <div class="trophy3d-slot" id="trophy3d-pa-${i}">
            <span class="trophy-card-count">×${a.count}</span>
            <span class="trophy3d-hint">Drag to rotate</span>
          </div>
          <div class="trophy-card-info">
            <div class="trophy-name">${esc(a.name)}</div>
          </div>
        </div>`).join('')}
    </div>` : `<div class="empty-state card card-pad"><div class="empty-icon">🏅</div><h3>No individual awards yet</h3><p>Log a Player of the Season or Golden Boot win in a season's Awards section.</p></div>`}

    ${t.awards.ballonDor.length ? `
    <div class="section-title">Ballon d'Or Finishes</div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Season</th><th>Finish</th></tr></thead>
        <tbody>${t.awards.ballonDor.map(b => `<tr><td>${esc(b.season)}</td><td>${esc(b.rank)}</td></tr>`).join('')}</tbody>
      </table>
    </div>` : ''}
  `;

  entries.forEach(([name, d], i) => {
    const type = trophy3dType(d.type);
    mountTrophy3dWhenReady('p-' + i, document.getElementById('trophy3d-p-' + i), type, trophy3dTier(type));
  });
  individualCards.forEach((a, i) => {
    mountTrophy3dWhenReady('pa-' + i, document.getElementById('trophy3d-pa-' + i), 'medal', 'gold');
  });
}

function renderPlayerInternational() {
  const el = $('#p-international-content');
  const t = computePlayerCareerTotals();
  const callUps = t.seasonsChrono.filter(s => s.international && s.international.calledUp);

  if (!callUps.length) {
    el.innerHTML = `<div class="empty-state card card-pad"><div class="empty-icon">🌍</div><h3>No international career yet</h3><p>Log a call-up inside a season's International Duty section to start tracking caps, goals and tournaments.</p></div>`;
    return;
  }

  const rows = callUps.map(s => `
    <tr>
      <td>${esc(s.seasonLabel)}</td>
      <td>${esc(s.international.team) || '—'}</td>
      <td>${num(s.international.caps)}</td>
      <td>${num(s.international.goals)}</td>
      <td>${esc(s.international.tournament) || '—'}</td>
      <td>${esc(s.international.tournamentResult) || '—'}</td>
    </tr>`).join('');

  el.innerHTML = `
    <div class="stat-grid" style="margin-bottom:18px;">
      <div class="stat-tile"><div class="stat-label">Total Caps</div><div class="stat-value">${t.intl.caps}</div></div>
      <div class="stat-tile"><div class="stat-label">International Goals</div><div class="stat-value">${t.intl.goals}</div></div>
      <div class="stat-tile"><div class="stat-label">Seasons Capped</div><div class="stat-value">${callUps.length}</div></div>
      <div class="stat-tile"><div class="stat-label">Tournaments</div><div class="stat-value">${t.intl.tournaments.length}</div></div>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Season</th><th>Team</th><th>Caps</th><th>Goals</th><th>Tournament</th><th>Result</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderPlayerSettings() {
  const el = $('#p-settings-content');
  const p = pState.player, s = appSettings;
  el.innerHTML = `
    <details class="form-section settings-block" open>
      <summary><span class="legend-icon">👤</span> Player Profile</summary>
      <div class="form-section-body">
      <div class="form-grid cols-2">
        <div class="field"><label>Player Name</label><input class="input" id="pf-plr-name" value="${esc(p.name)}" placeholder="e.g. Alex Morgan" /></div>
        <div class="field"><label>Nationality</label><input class="input" id="pf-plr-nat" value="${esc(p.nationality)}" placeholder="e.g. England" /></div>
        <div class="field"><label>Position</label>
          <select class="input select" id="pf-plr-position">
            ${PLAYER_POSITIONS.map(pos => `<option value="${pos}" ${p.position === pos ? 'selected' : ''}>${pos}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Starting Club</label><input class="input" id="pf-plr-club" value="${esc(p.startingClub)}" placeholder="e.g. Academy FC" /></div>
        <div class="field"><label>Career Start Year</label><input class="input" id="pf-plr-year" value="${esc(p.careerStartYear)}" placeholder="e.g. 2026" /></div>
      </div>
      <button class="btn btn-primary btn-sm" style="margin-top:14px;" data-action="save-player-profile">Save Profile</button>
      </div>
    </details>

    <div class="settings-block">
      <div class="settings-row install-app-row" ${deferredInstallPrompt ? '' : 'hidden'}>
        <div class="settings-row-text"><h4>Install App</h4><p>Add FC Career Tracker to your device as a standalone app.</p></div>
        <button class="btn btn-primary install-app-btn">Install</button>
      </div>
      <div class="settings-row">
        <div class="settings-row-text"><h4>Theme</h4><p>Choose how the tracker looks.</p></div>
        <div class="theme-toggle">
          <button data-theme="dark" class="${s.theme === 'dark' ? 'active' : ''}">Dark</button>
          <button data-theme="light" class="${s.theme === 'light' ? 'active' : ''}">Light</button>
          <button data-theme="system" class="${s.theme === 'system' ? 'active' : ''}">System</button>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-text"><h4>Layout</h4><p>Switch to a touch-friendly mobile layout with a bottom tab bar, or use the full desktop layout.</p></div>
        <div class="layout-toggle">
          <button data-layout="desktop" class="${s.layout === 'mobile' ? '' : 'active'}">Desktop</button>
          <button data-layout="mobile" class="${s.layout === 'mobile' ? 'active' : ''}">Mobile</button>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-text"><h4>Currency</h4><p>Used for transfer fees, wages and release clauses.</p></div>
        <select class="input select currency-select" style="width:120px;">
          <option value="£" ${s.currency === '£' ? 'selected' : ''}>£ GBP</option>
          <option value="€" ${s.currency === '€' ? 'selected' : ''}>€ EUR</option>
          <option value="$" ${s.currency === '$' ? 'selected' : ''}>$ USD</option>
        </select>
      </div>
      <div class="settings-row">
        <div class="settings-row-text"><h4>Trophy Render Quality</h4><p>Auto sharpens trophies on any screen; Low favors performance on older devices.</p></div>
        <div class="quality-toggle">
          <button data-quality="low" class="${s.renderQuality === 'low' ? 'active' : ''}">Low</button>
          <button data-quality="auto" class="${s.renderQuality === 'high' ? '' : 'active'}">Auto</button>
          <button data-quality="high" class="${s.renderQuality === 'high' ? 'active' : ''}">High</button>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-text"><h4>Export Data</h4><p>${backupStatusLine()} Everything here lives only in this browser — export a copy so a clear-cache or reinstall can't lose it.</p></div>
        <button class="btn btn-ghost" data-action="export-json">Export JSON</button>
      </div>
      <div class="settings-row">
        <div class="settings-row-text"><h4>Import Data</h4><p>Restore this save from a previously exported JSON backup. This replaces its current data.</p></div>
        <label class="btn btn-ghost" style="cursor:pointer;">Import JSON<input type="file" class="import-file-input" accept="application/json" style="display:none;" /></label>
      </div>
      ${transferCodeSettingsHTML()}
      <div class="settings-row">
        <div class="settings-row-text"><h4>Reset This Save</h4><p>Permanently clear the player profile and every season in this save. Cannot be undone.</p></div>
        <button class="btn btn-danger" data-action="reset-all">Reset This Save</button>
      </div>
    </div>
  `;
}

/* ---------------- Season form (add/edit modal) ---------------- */

// "2024/25" -> "2025/26", "2024" -> "2025", anything else -> append " (copy)"
// so duplicating a season as a template for the next one doesn't leave the
// label untouched (which would read as a duplicate season, not a new one).
function nextSeasonLabel(label) {
  if (!label) return '';
  const slash = label.match(/^(\d{4})\s*\/\s*(\d{2,4})$/);
  if (slash) {
    const startYear = parseInt(slash[1], 10);
    const endLen = slash[2].length;
    const nextStart = startYear + 1;
    const nextEndFull = nextStart + 1;
    const nextEnd = endLen === 2 ? String(nextEndFull).slice(-2) : String(nextEndFull);
    return `${nextStart}/${nextEnd}`;
  }
  const single = label.match(/^(\d{4})$/);
  if (single) return String(parseInt(single[1], 10) + 1);
  return label + ' (copy)';
}

function duplicateSeasonAsTemplate(id) {
  const s = state.seasons.find(s => s.id === id);
  if (!s) return;
  openSeasonModal(null);
  const draft = emptySeason();
  draft.seasonLabel = nextSeasonLabel(s.seasonLabel);
  draft.club = s.club;
  draft.country = s.country;
  draft.divisionTier = s.divisionTier;
  seasonDraft = draft;
  $('#season-form-body').innerHTML = renderSeasonFormHTML(seasonDraft, false);
  toast('Season duplicated as a template — review and save');
}

function duplicatePlayerSeasonAsTemplate(id) {
  const s = pState.seasons.find(s => s.id === id);
  if (!s) return;
  openPlayerSeasonModal(null);
  const draft = emptyPlayerSeason();
  draft.seasonLabel = nextSeasonLabel(s.seasonLabel);
  draft.club = s.club;
  draft.country = s.country;
  draft.divisionTier = s.divisionTier;
  draft.age = s.age !== '' && s.age != null ? String(num(s.age, 0) + 1) : s.age;
  draft.shirtNumber = s.shirtNumber;
  playerSeasonDraft = draft;
  $('#season-form-body').innerHTML = renderPlayerSeasonFormHTML(playerSeasonDraft);
  toast('Season duplicated as a template — review and save');
}

function openSeasonModal(season) {
  seasonModalMode = 'manager';
  seasonDraft = season ? deepClone(season) : emptySeason();
  editingSeasonId = season ? season.id : null;
  $('#season-modal-title').textContent = season ? `Edit Season — ${season.seasonLabel || ''} ${season.club || ''}` : 'Add Season';
  $('#season-form-body').innerHTML = renderSeasonFormHTML(seasonDraft, !!season);
  $('#season-modal').hidden = false;
  document.body.style.overflow = 'hidden';
  focusModal($('#season-modal'));
}

function closeSeasonModal() {
  $('#season-modal').hidden = true;
  document.body.style.overflow = '';
  seasonDraft = null;
  editingSeasonId = null;
  playerSeasonDraft = null;
  editingPlayerSeasonId = null;
  restoreFocusAfterModal();
}

function repeatRowsHTML(kind, items, rowFieldsFn) {
  if (!items.length) return '<p class="hint">None added yet.</p>';
  return items.map((item, i) => rowFieldsFn(item, i, kind)).join('');
}

function competitionRowHTML(c, i) {
  return `<div class="repeat-row">
    <div class="field"><label>Competition</label><input class="input" data-repeat="competitions" data-index="${i}" data-field="name" value="${esc(c.name)}" placeholder="e.g. FA Cup" /></div>
    <div class="field"><label>Type</label>
      <select class="input select" data-repeat="competitions" data-index="${i}" data-field="type">
        ${COMPETITION_TYPES.map(t => `<option value="${t}" ${c.type === t ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>Result</label>
      <select class="input select" data-repeat="competitions" data-index="${i}" data-field="result">
        ${RESULT_OPTIONS.map(r => `<option value="${r}" ${c.result === r ? 'selected' : ''}>${r}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>P</label><input class="input" type="number" min="0" data-repeat="competitions" data-index="${i}" data-field="played" value="${esc(c.played)}" /></div>
    <div class="field"><label>W</label><input class="input" type="number" min="0" data-repeat="competitions" data-index="${i}" data-field="won" value="${esc(c.won)}" /></div>
    <div class="field"><label>D</label><input class="input" type="number" min="0" data-repeat="competitions" data-index="${i}" data-field="drawn" value="${esc(c.drawn)}" /></div>
    <div class="field"><label>L</label><input class="input" type="number" min="0" data-repeat="competitions" data-index="${i}" data-field="lost" value="${esc(c.lost)}" /></div>
    <div class="field"><label>GF</label><input class="input" type="number" min="0" data-repeat="competitions" data-index="${i}" data-field="gf" value="${esc(c.gf)}" /></div>
    <div class="field"><label>GA</label><input class="input" type="number" min="0" data-repeat="competitions" data-index="${i}" data-field="ga" value="${esc(c.ga)}" /></div>
    <button type="button" class="remove-row-btn" data-action="remove-row" data-repeat="competitions" data-index="${i}" title="Remove" aria-label="Remove competition row">✕</button>
  </div>`;
}

function transferRowHTML(tr, i, kind) {
  const clubLabel = kind === 'transfersIn' ? 'From Club' : 'To Club';
  return `<div class="repeat-row">
    <div class="field"><label>Player</label><input class="input" data-repeat="${kind}" data-index="${i}" data-field="name" value="${esc(tr.name)}" placeholder="Player name" /></div>
    <div class="field"><label>Position</label>
      <select class="input select" data-repeat="${kind}" data-index="${i}" data-field="position">
        ${PLAYER_POSITIONS.map(p => `<option value="${p}" ${tr.position === p ? 'selected' : ''}>${p}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>${clubLabel}</label><input class="input" data-repeat="${kind}" data-index="${i}" data-field="club" value="${esc(tr.club)}" /></div>
    <div class="field"><label>Type</label>
      <select class="input select" data-repeat="${kind}" data-index="${i}" data-field="type">
        ${TRANSFER_TYPES.map(t => `<option value="${t}" ${tr.type === t ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>Fee (${appSettings.currency}M)</label><input class="input" type="number" step="0.1" min="0" data-repeat="${kind}" data-index="${i}" data-field="fee" value="${esc(tr.fee)}" /></div>
    <button type="button" class="remove-row-btn" data-action="remove-row" data-repeat="${kind}" data-index="${i}" title="Remove" aria-label="Remove row">✕</button>
  </div>`;
}

function objectiveRowHTML(o, i) {
  return `<div class="repeat-row">
    <div class="field" style="flex-basis: 280px;"><label>Objective</label><input class="input" data-repeat="boardObjectives" data-index="${i}" data-field="description" value="${esc(o.description)}" placeholder="e.g. Finish top half" /></div>
    <div class="field checkbox-field" style="flex-basis:120px;align-self:end;padding-bottom:9px;">
      <input type="checkbox" id="obj-ach-${i}" data-repeat="boardObjectives" data-index="${i}" data-field="achieved" ${o.achieved ? 'checked' : ''} />
      <label for="obj-ach-${i}">Achieved</label>
    </div>
    <button type="button" class="remove-row-btn" data-action="remove-row" data-repeat="boardObjectives" data-index="${i}" title="Remove" aria-label="Remove board objective row">✕</button>
  </div>`;
}

function matchResultBadgeHTML(gf, ga) {
  const r = matchResult(gf, ga);
  return r ? `<span class="match-result-badge match-result-${r.toLowerCase()}">${r}</span>` : '';
}

function matchRowHTML(m, i) {
  return `<div class="repeat-row match-row">
    <div class="field" style="flex-basis:90px;"><label>Date</label><input class="input" data-repeat="matches" data-index="${i}" data-field="date" value="${esc(m.date)}" placeholder="12 Aug" /></div>
    <div class="field"><label>Competition</label><input class="input" data-repeat="matches" data-index="${i}" data-field="competition" value="${esc(m.competition)}" placeholder="League" /></div>
    <div class="field"><label>Opponent</label><input class="input" data-repeat="matches" data-index="${i}" data-field="opponent" value="${esc(m.opponent)}" placeholder="Opponent" /></div>
    <div class="field" style="flex-basis:105px;"><label>Venue</label>
      <select class="input select" data-repeat="matches" data-index="${i}" data-field="venue">
        ${['Home', 'Away', 'Neutral'].map(v => `<option value="${v}" ${m.venue === v ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
    </div>
    <div class="field" style="flex-basis:64px;"><label>GF</label><input class="input" type="number" min="0" data-repeat="matches" data-index="${i}" data-field="gf" value="${esc(m.gf)}" /></div>
    <div class="field" style="flex-basis:64px;"><label>GA</label><input class="input" type="number" min="0" data-repeat="matches" data-index="${i}" data-field="ga" value="${esc(m.ga)}" /></div>
    <div class="field match-result-field" style="flex-basis:44px;align-self:end;padding-bottom:9px;">${matchResultBadgeHTML(m.gf, m.ga)}</div>
    <button type="button" class="remove-row-btn" data-action="remove-row" data-repeat="matches" data-index="${i}" title="Remove" aria-label="Remove match row">✕</button>
  </div>`;
}

function playerMatchRowHTML(m, i) {
  return `<div class="repeat-row match-row">
    <div class="field" style="flex-basis:90px;"><label>Date</label><input class="input" data-repeat="pmatches" data-index="${i}" data-field="date" value="${esc(m.date)}" placeholder="12 Aug" /></div>
    <div class="field"><label>Competition</label><input class="input" data-repeat="pmatches" data-index="${i}" data-field="competition" value="${esc(m.competition)}" placeholder="League" /></div>
    <div class="field"><label>Opponent</label><input class="input" data-repeat="pmatches" data-index="${i}" data-field="opponent" value="${esc(m.opponent)}" placeholder="Opponent" /></div>
    <div class="field" style="flex-basis:105px;"><label>Venue</label>
      <select class="input select" data-repeat="pmatches" data-index="${i}" data-field="venue">
        ${['Home', 'Away', 'Neutral'].map(v => `<option value="${v}" ${m.venue === v ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
    </div>
    <div class="field" style="flex-basis:58px;"><label>GF</label><input class="input" type="number" min="0" data-repeat="pmatches" data-index="${i}" data-field="gf" value="${esc(m.gf)}" /></div>
    <div class="field" style="flex-basis:58px;"><label>GA</label><input class="input" type="number" min="0" data-repeat="pmatches" data-index="${i}" data-field="ga" value="${esc(m.ga)}" /></div>
    <div class="field" style="flex-basis:58px;"><label>Goals</label><input class="input" type="number" min="0" data-repeat="pmatches" data-index="${i}" data-field="goals" value="${esc(m.goals)}" /></div>
    <div class="field" style="flex-basis:58px;"><label>Assists</label><input class="input" type="number" min="0" data-repeat="pmatches" data-index="${i}" data-field="assists" value="${esc(m.assists)}" /></div>
    <div class="field" style="flex-basis:58px;"><label>Rating</label><input class="input" type="number" step="0.1" min="0" max="10" data-repeat="pmatches" data-index="${i}" data-field="rating" value="${esc(m.rating)}" /></div>
    <div class="field match-result-field" style="flex-basis:44px;align-self:end;padding-bottom:9px;">${matchResultBadgeHTML(m.gf, m.ga)}</div>
    <button type="button" class="remove-row-btn" data-action="remove-row" data-repeat="pmatches" data-index="${i}" title="Remove" aria-label="Remove match row">✕</button>
  </div>`;
}

function detailsOpen(o) { return o ? 'open' : ''; }

function renderSeasonFormHTML(d) {
  const L = d.league, PA = d.playerAwards, MS = d.managerStanding, F = d.finances, Y = d.youth;

  const openAwards = !!(PA.topScorerName || PA.topAssisterName || PA.playerOfTheSeason || PA.youngPlayerOfTheSeason || PA.teamOfTheSeason || PA.goldenBoot || PA.goldenGlove || PA.otherAwards);
  const openStanding = !!(MS.managerOfTheSeason || num(MS.motmCount) > 0 || num(MS.reputationStars, 3) !== 3 || num(MS.jobSecurity, 70) !== 70);
  const openFin = !!(F.transferBudget || F.wageBudget || F.prizeMoney || F.sponsorship);
  const openYouth = !!(Y.playersPromoted || num(Y.regensGenerated) > 0 || Y.notes);

  const quicknav = `<div class="modal-quicknav">${SEASON_SECTIONS.map(s =>
    `<button type="button" class="quicknav-pill" data-action="jump-section" data-target="${s.id}">${s.icon} ${s.label}</button>`
  ).join('')}</div>`;

  return quicknav + `
  <form id="season-form">
    <details class="form-section" id="fs-basics" open>
      <summary><span class="legend-icon">📋</span> Basics</summary>
      <div class="form-section-body">
      <div class="form-grid cols-2">
        <div class="field"><label>Season *</label><input class="input" id="f-seasonLabel" required value="${esc(d.seasonLabel)}" placeholder="e.g. 2026/27" /></div>
        <div class="field"><label>Club *</label><input class="input" id="f-club" required value="${esc(d.club)}" placeholder="e.g. Manchester United" /></div>
        <div class="field"><label>Country</label><input class="input" id="f-country" value="${esc(d.country)}" placeholder="e.g. England" /></div>
        <div class="field"><label>Division / Tier</label><input class="input" id="f-divisionTier" value="${esc(d.divisionTier)}" placeholder="e.g. Premier League" /></div>
      </div>
      </div>
    </details>

    <details class="form-section" id="fs-league" open>
      <summary><span class="legend-icon">🏟️</span> League Record</summary>
      <div class="form-section-body">
      <div class="form-grid cols-4">
        <div class="field"><label>Played</label><input class="input" type="number" min="0" id="f-league-played" value="${esc(L.played)}" /></div>
        <div class="field"><label>Won</label><input class="input" type="number" min="0" id="f-league-won" value="${esc(L.won)}" /></div>
        <div class="field"><label>Drawn</label><input class="input" type="number" min="0" id="f-league-drawn" value="${esc(L.drawn)}" /></div>
        <div class="field"><label>Lost</label><input class="input" type="number" min="0" id="f-league-lost" value="${esc(L.lost)}" /></div>
        <div class="field"><label>Goals For</label><input class="input" type="number" min="0" id="f-league-gf" value="${esc(L.gf)}" /></div>
        <div class="field"><label>Goals Against</label><input class="input" type="number" min="0" id="f-league-ga" value="${esc(L.ga)}" /></div>
        <div class="field"><label>Points</label><input class="input" type="number" min="0" id="f-league-points" value="${esc(L.points)}" /></div>
        <div class="field"><label>Final Position</label><input class="input" type="number" min="1" id="f-league-position" value="${esc(L.position)}" /></div>
        <div class="field"><label>Teams in League</label><input class="input" type="number" min="1" id="f-league-leagueSize" value="${esc(L.leagueSize)}" /></div>
      </div>
      <div class="form-grid cols-2" style="margin-top:12px;">
        <div class="field checkbox-field"><input type="checkbox" id="f-league-promoted" ${L.promoted ? 'checked' : ''} /><label for="f-league-promoted">Promoted</label></div>
        <div class="field checkbox-field"><input type="checkbox" id="f-league-relegated" ${L.relegated ? 'checked' : ''} /><label for="f-league-relegated">Relegated</label></div>
        <div class="field checkbox-field"><input type="checkbox" id="f-league-playoff" ${L.playoff ? 'checked' : ''} /><label for="f-league-playoff">Reached Playoffs</label></div>
      </div>
      </div>
    </details>

    <details class="form-section" id="fs-matches" ${detailsOpen(d.matches.length > 0)}>
      <summary><span class="legend-icon">📅</span> Match Log ${d.matches.length ? `<span class="chip-count">${d.matches.length}</span>` : ''}</summary>
      <div class="form-section-body">
      <p class="hint" style="margin-bottom:10px;">Optional — log individual results if you want a match-by-match history for this season.</p>
      <div class="repeat-list" id="repeat-matches">${repeatRowsHTML('matches', d.matches, matchRowHTML)}</div>
      <button type="button" class="add-row-btn" data-action="add-row" data-repeat="matches">+ Add Match</button>
      </div>
    </details>

    <details class="form-section" id="fs-competitions" ${detailsOpen(d.competitions.length > 0)}>
      <summary><span class="legend-icon">🏆</span> Cup &amp; Continental Competitions ${d.competitions.length ? `<span class="chip-count">${d.competitions.length}</span>` : ''}</summary>
      <div class="form-section-body">
      <div class="repeat-list" id="repeat-competitions">${repeatRowsHTML('competitions', d.competitions, competitionRowHTML)}</div>
      <button type="button" class="add-row-btn" data-action="add-row" data-repeat="competitions">+ Add Competition</button>
      </div>
    </details>

    <details class="form-section" id="fs-awards" ${detailsOpen(openAwards)}>
      <summary><span class="legend-icon">⭐</span> Player Stats &amp; Individual Awards</summary>
      <div class="form-section-body">
      <div class="form-grid cols-2">
        <div class="field"><label>Top Scorer</label><input class="input" id="f-pa-topScorerName" value="${esc(PA.topScorerName)}" placeholder="Player name" /></div>
        <div class="field"><label>Goals</label><input class="input" type="number" min="0" id="f-pa-topScorerGoals" value="${esc(PA.topScorerGoals)}" /></div>
        <div class="field"><label>Top Assister</label><input class="input" id="f-pa-topAssisterName" value="${esc(PA.topAssisterName)}" placeholder="Player name" /></div>
        <div class="field"><label>Assists</label><input class="input" type="number" min="0" id="f-pa-topAssisterAssists" value="${esc(PA.topAssisterAssists)}" /></div>
        <div class="field"><label>Player of the Season</label><input class="input" id="f-pa-playerOfTheSeason" value="${esc(PA.playerOfTheSeason)}" /></div>
        <div class="field"><label>Young Player of the Season</label><input class="input" id="f-pa-youngPlayerOfTheSeason" value="${esc(PA.youngPlayerOfTheSeason)}" /></div>
        <div class="field field-full"><label>Team of the Season (players)</label><input class="input" id="f-pa-teamOfTheSeason" value="${esc(PA.teamOfTheSeason)}" placeholder="Comma-separated list" /></div>
      </div>
      <div class="form-grid cols-2" style="margin-top:12px;">
        <div class="field checkbox-field"><input type="checkbox" id="f-pa-goldenBoot" ${PA.goldenBoot ? 'checked' : ''} /><label for="f-pa-goldenBoot">Won League Golden Boot</label></div>
        <div class="field checkbox-field"><input type="checkbox" id="f-pa-goldenGlove" ${PA.goldenGlove ? 'checked' : ''} /><label for="f-pa-goldenGlove">Won League Golden Glove</label></div>
      </div>
      <div class="field field-full" style="margin-top:12px;"><label>Other Awards</label><textarea class="input" id="f-pa-otherAwards" placeholder="e.g. Ballon d'Or nomination, PFA Team of the Year...">${esc(PA.otherAwards)}</textarea></div>
      </div>
    </details>

    <details class="form-section" id="fs-standing" ${detailsOpen(openStanding)}>
      <summary><span class="legend-icon">📈</span> Manager Standing</summary>
      <div class="form-section-body">
      <div class="form-grid cols-4">
        <div class="field checkbox-field" style="align-self:center;"><input type="checkbox" id="f-ms-managerOfTheSeason" ${MS.managerOfTheSeason ? 'checked' : ''} /><label for="f-ms-managerOfTheSeason">Manager of the Season</label></div>
        <div class="field"><label>Manager of the Month (count)</label><input class="input" type="number" min="0" id="f-ms-motmCount" value="${esc(MS.motmCount)}" /></div>
        <div class="field"><label>Reputation (1-5 stars)</label><input class="input" type="number" min="1" max="5" id="f-ms-reputationStars" value="${esc(MS.reputationStars)}" /></div>
        <div class="field"><label>Job Security (%)</label><input class="input" type="number" min="0" max="100" id="f-ms-jobSecurity" value="${esc(MS.jobSecurity)}" /></div>
      </div>
      </div>
    </details>

    <details class="form-section" id="fs-transfers-in" ${detailsOpen(d.transfersIn.length > 0)}>
      <summary><span class="legend-icon">⬇️</span> Transfers In ${d.transfersIn.length ? `<span class="chip-count">${d.transfersIn.length}</span>` : ''}</summary>
      <div class="form-section-body">
      <div class="repeat-list" id="repeat-transfersIn">${repeatRowsHTML('transfersIn', d.transfersIn, transferRowHTML)}</div>
      <button type="button" class="add-row-btn" data-action="add-row" data-repeat="transfersIn">+ Add Signing</button>
      </div>
    </details>

    <details class="form-section" id="fs-transfers-out" ${detailsOpen(d.transfersOut.length > 0)}>
      <summary><span class="legend-icon">⬆️</span> Transfers Out ${d.transfersOut.length ? `<span class="chip-count">${d.transfersOut.length}</span>` : ''}</summary>
      <div class="form-section-body">
      <div class="repeat-list" id="repeat-transfersOut">${repeatRowsHTML('transfersOut', d.transfersOut, transferRowHTML)}</div>
      <button type="button" class="add-row-btn" data-action="add-row" data-repeat="transfersOut">+ Add Sale</button>
      </div>
    </details>

    <details class="form-section" id="fs-finances" ${detailsOpen(openFin)}>
      <summary><span class="legend-icon">💰</span> Finances (${appSettings.currency}M)</summary>
      <div class="form-section-body">
      <div class="form-grid cols-4">
        <div class="field"><label>Transfer Budget</label><input class="input" type="number" step="0.1" id="f-fin-transferBudget" value="${esc(F.transferBudget)}" /></div>
        <div class="field"><label>Wage Budget</label><input class="input" type="number" step="0.1" id="f-fin-wageBudget" value="${esc(F.wageBudget)}" /></div>
        <div class="field"><label>Prize Money</label><input class="input" type="number" step="0.1" id="f-fin-prizeMoney" value="${esc(F.prizeMoney)}" /></div>
        <div class="field"><label>Sponsorship Income</label><input class="input" type="number" step="0.1" id="f-fin-sponsorship" value="${esc(F.sponsorship)}" /></div>
      </div>
      </div>
    </details>

    <details class="form-section" id="fs-objectives" ${detailsOpen(d.boardObjectives.length > 0)}>
      <summary><span class="legend-icon">🎯</span> Board Objectives ${d.boardObjectives.length ? `<span class="chip-count">${d.boardObjectives.length}</span>` : ''}</summary>
      <div class="form-section-body">
      <div class="repeat-list" id="repeat-boardObjectives">${repeatRowsHTML('boardObjectives', d.boardObjectives, objectiveRowHTML)}</div>
      <button type="button" class="add-row-btn" data-action="add-row" data-repeat="boardObjectives">+ Add Objective</button>
      </div>
    </details>

    <details class="form-section" id="fs-youth" ${detailsOpen(openYouth)}>
      <summary><span class="legend-icon">🌱</span> Youth Academy</summary>
      <div class="form-section-body">
      <div class="form-grid cols-2">
        <div class="field field-full"><label>Players Promoted to First Team</label><input class="input" id="f-youth-playersPromoted" value="${esc(Y.playersPromoted)}" placeholder="Comma-separated list" /></div>
        <div class="field"><label>Regens / Newgens Generated</label><input class="input" type="number" min="0" id="f-youth-regensGenerated" value="${esc(Y.regensGenerated)}" /></div>
      </div>
      <div class="field field-full" style="margin-top:12px;"><label>Notes</label><textarea class="input" id="f-youth-notes" placeholder="Standout prospects, potential ratings...">${esc(Y.notes)}</textarea></div>
      </div>
    </details>

    <details class="form-section" id="fs-notes" ${detailsOpen(!!d.notes)}>
      <summary><span class="legend-icon">📝</span> Season Notes</summary>
      <div class="form-section-body">
      <textarea class="input" id="f-notes" placeholder="Anything else worth remembering about this season...">${esc(d.notes)}</textarea>
      </div>
    </details>

    <div class="modal-footer-actions">
      <div>${editingSeasonId ? `<button type="button" class="btn btn-danger btn-sm" data-action="delete-season" data-id="${editingSeasonId}">Delete Season</button>` : '<span></span>'}</div>
      <div style="display:flex;gap:10px;">
        <button type="button" class="btn btn-ghost" data-action="close-season-modal">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Season</button>
      </div>
    </div>
  </form>`;
}

function reRenderRepeatSection(kind) {
  const container = $('#repeat-' + kind);
  if (!container) return;
  const fn = kind === 'competitions' ? competitionRowHTML
    : kind === 'boardObjectives' ? objectiveRowHTML
    : kind === 'matches' ? matchRowHTML
    : transferRowHTML;
  container.innerHTML = repeatRowsHTML(kind, seasonDraft[kind], fn);
}

function collectSeasonFormIntoDraft() {
  const g = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  const gc = id => { const el = document.getElementById(id); return el ? el.checked : false; };
  const d = seasonDraft;
  d.seasonLabel = g('f-seasonLabel').trim();
  d.club = g('f-club').trim();
  d.country = g('f-country').trim();
  d.divisionTier = g('f-divisionTier').trim();

  d.league = {
    played: num(g('f-league-played')), won: num(g('f-league-won')), drawn: num(g('f-league-drawn')),
    lost: num(g('f-league-lost')), gf: num(g('f-league-gf')), ga: num(g('f-league-ga')),
    points: num(g('f-league-points')), position: g('f-league-position') === '' ? '' : num(g('f-league-position')),
    leagueSize: g('f-league-leagueSize') === '' ? '' : num(g('f-league-leagueSize')),
    promoted: gc('f-league-promoted'), relegated: gc('f-league-relegated'), playoff: gc('f-league-playoff')
  };

  d.playerAwards = {
    topScorerName: g('f-pa-topScorerName').trim(), topScorerGoals: g('f-pa-topScorerGoals'),
    topAssisterName: g('f-pa-topAssisterName').trim(), topAssisterAssists: g('f-pa-topAssisterAssists'),
    playerOfTheSeason: g('f-pa-playerOfTheSeason').trim(), youngPlayerOfTheSeason: g('f-pa-youngPlayerOfTheSeason').trim(),
    teamOfTheSeason: g('f-pa-teamOfTheSeason').trim(), goldenBoot: gc('f-pa-goldenBoot'), goldenGlove: gc('f-pa-goldenGlove'),
    otherAwards: g('f-pa-otherAwards').trim()
  };

  d.managerStanding = {
    managerOfTheSeason: gc('f-ms-managerOfTheSeason'), motmCount: num(g('f-ms-motmCount')),
    reputationStars: clamp(num(g('f-ms-reputationStars'), 3), 1, 5), jobSecurity: clamp(num(g('f-ms-jobSecurity'), 70), 0, 100)
  };

  d.finances = {
    transferBudget: g('f-fin-transferBudget'), wageBudget: g('f-fin-wageBudget'),
    prizeMoney: g('f-fin-prizeMoney'), sponsorship: g('f-fin-sponsorship')
  };

  d.youth = {
    playersPromoted: g('f-youth-playersPromoted').trim(), regensGenerated: g('f-youth-regensGenerated'),
    notes: g('f-youth-notes').trim()
  };

  d.notes = g('f-notes').trim();
  // competitions / transfersIn / transfersOut / boardObjectives already kept live via delegated input handlers
  return d;
}

function saveSeasonDraft() {
  collectSeasonFormIntoDraft();
  if (!seasonDraft.seasonLabel || !seasonDraft.club) {
    toast('Season and club are required', 'danger');
    focusFieldErrors(
      !seasonDraft.seasonLabel ? 'f-seasonLabel' : null,
      !seasonDraft.club ? 'f-club' : null
    );
    return;
  }
  const L = seasonDraft.league;
  const sumWDL = num(L.won) + num(L.drawn) + num(L.lost);
  if (num(L.played) !== sumWDL) {
    toast(`League Played (${num(L.played)}) doesn't match Won+Drawn+Lost (${sumWDL}) — please fix your league record`, 'danger');
    focusFieldErrors('f-league-played', 'f-league-won', 'f-league-drawn', 'f-league-lost');
    return;
  }
  const idx = state.seasons.findIndex(s => s.id === seasonDraft.id);
  if (idx >= 0) state.seasons[idx] = seasonDraft;
  else state.seasons.push(seasonDraft);
  saveState();
  closeSeasonModal();
  toast('Season saved');
  renderCurrentTab();
}

function deleteSeason(id) {
  state.seasons = state.seasons.filter(s => s.id !== id);
  saveState();
  toast('Season deleted', 'danger');
  if (!$('#season-modal').hidden) closeSeasonModal();
  renderCurrentTab();
}

/* ---------------- Player season form (add/edit modal) ---------------- */

function openPlayerSeasonModal(season) {
  seasonModalMode = 'player';
  playerSeasonDraft = season ? deepClone(season) : emptyPlayerSeason();
  editingPlayerSeasonId = season ? season.id : null;
  $('#season-modal-title').textContent = season ? `Edit Season — ${season.seasonLabel || ''} ${season.club || ''}` : 'Add Season';
  $('#season-form-body').innerHTML = renderPlayerSeasonFormHTML(playerSeasonDraft);
  $('#season-modal').hidden = false;
  document.body.style.overflow = 'hidden';
  focusModal($('#season-modal'));
}

function playerCompetitionRowHTML(c, i) {
  return `<div class="repeat-row">
    <div class="field"><label>Competition</label><input class="input" data-repeat="pcompetitions" data-index="${i}" data-field="name" value="${esc(c.name)}" placeholder="e.g. FA Cup" /></div>
    <div class="field"><label>Type</label>
      <select class="input select" data-repeat="pcompetitions" data-index="${i}" data-field="type">
        ${COMPETITION_TYPES.map(t => `<option value="${t}" ${c.type === t ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>Result</label>
      <select class="input select" data-repeat="pcompetitions" data-index="${i}" data-field="result">
        ${RESULT_OPTIONS.map(r => `<option value="${r}" ${c.result === r ? 'selected' : ''}>${r}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>Apps</label><input class="input" type="number" min="0" data-repeat="pcompetitions" data-index="${i}" data-field="apps" value="${esc(c.apps)}" /></div>
    <div class="field"><label>Goals</label><input class="input" type="number" min="0" data-repeat="pcompetitions" data-index="${i}" data-field="goals" value="${esc(c.goals)}" /></div>
    <div class="field"><label>Assists</label><input class="input" type="number" min="0" data-repeat="pcompetitions" data-index="${i}" data-field="assists" value="${esc(c.assists)}" /></div>
    <button type="button" class="remove-row-btn" data-action="remove-row" data-repeat="pcompetitions" data-index="${i}" title="Remove" aria-label="Remove competition row">✕</button>
  </div>`;
}

function reRenderPlayerRepeatSection(kind) {
  const container = $('#repeat-' + kind);
  if (!container) return;
  if (kind === 'pmatches') {
    container.innerHTML = repeatRowsHTML('pmatches', playerSeasonDraft.matches, playerMatchRowHTML);
  } else {
    container.innerHTML = repeatRowsHTML('pcompetitions', playerSeasonDraft.competitions, playerCompetitionRowHTML);
  }
}

function renderPlayerSeasonFormHTML(d) {
  const R = d.ratings, A = d.appearances, AT = d.attack, DE = d.defending, GK = d.goalkeeping, DI = d.discipline, F = d.form, L = d.league, AW = d.awards, TR = d.transfer, C = d.contract, I = d.international;

  const openAttack = !!(num(AT.goals) || num(AT.assists) || num(AT.shotsOnTarget) || num(AT.shotsTotal) || num(AT.keyPasses) || num(AT.dribbles));
  const openDefending = !!(num(DE.tackles) || num(DE.interceptions) || num(DE.duelsWon));
  const openGoalkeeping = !!(num(GK.saves) || num(GK.goalsConceded) || num(GK.cleanSheets));
  const openDiscipline = !!(num(DI.yellow) || num(DI.red) || num(DI.fouls) || F.avgRating || num(F.motmCount));
  const openTeam = !!(L.position || d.competitions.length > 0);
  const openAwards = !!(AW.potsClub || AW.yotsClub || AW.teamOfSeason || AW.goldenBoot || AW.goldenGlove || AW.ballonDorRank || AW.otherAwards);
  const openTransfer = !!TR.moved;
  const openContract = !!(C.wage || C.yearsRemaining || C.releaseClause);
  const openIntl = !!I.calledUp;

  const quicknav = `<div class="modal-quicknav">${PLAYER_SEASON_SECTIONS.map(s =>
    `<button type="button" class="quicknav-pill" data-action="jump-section" data-target="${s.id}">${s.icon} ${s.label}</button>`
  ).join('')}</div>`;

  return quicknav + `
  <form id="player-season-form">
    <details class="form-section" id="pfs-basics" open>
      <summary><span class="legend-icon">📋</span> Basics</summary>
      <div class="form-section-body">
      <div class="form-grid cols-2">
        <div class="field"><label>Season *</label><input class="input" id="pf-seasonLabel" required value="${esc(d.seasonLabel)}" placeholder="e.g. 2026/27" /></div>
        <div class="field"><label>Club *</label><input class="input" id="pf-club" required value="${esc(d.club)}" placeholder="e.g. Manchester United" /></div>
        <div class="field"><label>Country</label><input class="input" id="pf-country" value="${esc(d.country)}" placeholder="e.g. England" /></div>
        <div class="field"><label>Division / Tier</label><input class="input" id="pf-divisionTier" value="${esc(d.divisionTier)}" placeholder="e.g. Premier League" /></div>
        <div class="field"><label>Age</label><input class="input" type="number" min="14" max="50" id="pf-age" value="${esc(d.age)}" /></div>
        <div class="field"><label>Shirt Number</label><input class="input" type="number" min="1" max="99" id="pf-shirtNumber" value="${esc(d.shirtNumber)}" /></div>
      </div>
      </div>
    </details>

    <details class="form-section" id="pfs-ratings" open>
      <summary><span class="legend-icon">📊</span> Ratings &amp; Development</summary>
      <div class="form-section-body">
      <div class="form-grid cols-4">
        <div class="field"><label>Overall (Start)</label><input class="input" type="number" min="1" max="99" id="pf-rat-overallStart" value="${esc(R.overallStart)}" /></div>
        <div class="field"><label>Overall (End)</label><input class="input" type="number" min="1" max="99" id="pf-rat-overallEnd" value="${esc(R.overallEnd)}" /></div>
        <div class="field"><label>Potential</label><input class="input" type="number" min="1" max="99" id="pf-rat-potential" value="${esc(R.potential)}" /></div>
        <div class="field"><label>Skill Moves (1-5)</label><input class="input" type="number" min="1" max="5" id="pf-rat-skillMoves" value="${esc(R.skillMoves)}" /></div>
        <div class="field"><label>Weak Foot (1-5)</label><input class="input" type="number" min="1" max="5" id="pf-rat-weakFoot" value="${esc(R.weakFoot)}" /></div>
      </div>
      </div>
    </details>

    <details class="form-section" id="pfs-appearances" open>
      <summary><span class="legend-icon">👟</span> Appearances</summary>
      <div class="form-section-body">
      <div class="form-grid cols-4">
        <div class="field"><label>Played</label><input class="input" type="number" min="0" id="pf-app-played" value="${esc(A.played)}" /></div>
        <div class="field"><label>Started</label><input class="input" type="number" min="0" id="pf-app-started" value="${esc(A.started)}" /></div>
        <div class="field"><label>Sub Appearances</label><input class="input" type="number" min="0" id="pf-app-subApps" value="${esc(A.subApps)}" /></div>
        <div class="field"><label>Minutes Played</label><input class="input" type="number" min="0" id="pf-app-minutes" value="${esc(A.minutes)}" /></div>
      </div>
      </div>
    </details>

    <details class="form-section" id="pfs-matches" ${detailsOpen(d.matches.length > 0)}>
      <summary><span class="legend-icon">📅</span> Match Log ${d.matches.length ? `<span class="chip-count">${d.matches.length}</span>` : ''}</summary>
      <div class="form-section-body">
      <p class="hint" style="margin-bottom:10px;">Optional — log individual appearances if you want a match-by-match history for this season.</p>
      <div class="repeat-list" id="repeat-pmatches">${repeatRowsHTML('pmatches', d.matches, playerMatchRowHTML)}</div>
      <button type="button" class="add-row-btn" data-action="add-row" data-repeat="pmatches">+ Add Match</button>
      </div>
    </details>

    <details class="form-section" id="pfs-attack" ${detailsOpen(openAttack)}>
      <summary><span class="legend-icon">⚽</span> Attacking Output</summary>
      <div class="form-section-body">
      <div class="form-grid cols-4">
        <div class="field"><label>Goals</label><input class="input" type="number" min="0" id="pf-atk-goals" value="${esc(AT.goals)}" /></div>
        <div class="field"><label>Assists</label><input class="input" type="number" min="0" id="pf-atk-assists" value="${esc(AT.assists)}" /></div>
        <div class="field"><label>Shots on Target</label><input class="input" type="number" min="0" id="pf-atk-shotsOnTarget" value="${esc(AT.shotsOnTarget)}" /></div>
        <div class="field"><label>Total Shots</label><input class="input" type="number" min="0" id="pf-atk-shotsTotal" value="${esc(AT.shotsTotal)}" /></div>
        <div class="field"><label>Key Passes</label><input class="input" type="number" min="0" id="pf-atk-keyPasses" value="${esc(AT.keyPasses)}" /></div>
        <div class="field"><label>Dribbles Completed</label><input class="input" type="number" min="0" id="pf-atk-dribbles" value="${esc(AT.dribbles)}" /></div>
      </div>
      </div>
    </details>

    <details class="form-section" id="pfs-defending" ${detailsOpen(openDefending)}>
      <summary><span class="legend-icon">🛡️</span> Defending</summary>
      <div class="form-section-body">
      <div class="form-grid cols-4">
        <div class="field"><label>Tackles</label><input class="input" type="number" min="0" id="pf-def-tackles" value="${esc(DE.tackles)}" /></div>
        <div class="field"><label>Interceptions</label><input class="input" type="number" min="0" id="pf-def-interceptions" value="${esc(DE.interceptions)}" /></div>
        <div class="field"><label>Duels Won</label><input class="input" type="number" min="0" id="pf-def-duelsWon" value="${esc(DE.duelsWon)}" /></div>
      </div>
      </div>
    </details>

    <details class="form-section" id="pfs-goalkeeping" ${detailsOpen(openGoalkeeping)}>
      <summary><span class="legend-icon">🧤</span> Goalkeeping</summary>
      <div class="form-section-body">
      <div class="form-grid cols-4">
        <div class="field"><label>Saves</label><input class="input" type="number" min="0" id="pf-gk-saves" value="${esc(GK.saves)}" /></div>
        <div class="field"><label>Goals Conceded</label><input class="input" type="number" min="0" id="pf-gk-goalsConceded" value="${esc(GK.goalsConceded)}" /></div>
        <div class="field"><label>Clean Sheets</label><input class="input" type="number" min="0" id="pf-gk-cleanSheets" value="${esc(GK.cleanSheets)}" /></div>
      </div>
      <p class="hint" style="margin-top:8px;">Only relevant if you played in goal this season.</p>
      </div>
    </details>

    <details class="form-section" id="pfs-discipline" ${detailsOpen(openDiscipline)}>
      <summary><span class="legend-icon">🟨</span> Discipline &amp; Form</summary>
      <div class="form-section-body">
      <div class="form-grid cols-4">
        <div class="field"><label>Yellow Cards</label><input class="input" type="number" min="0" id="pf-dis-yellow" value="${esc(DI.yellow)}" /></div>
        <div class="field"><label>Red Cards</label><input class="input" type="number" min="0" id="pf-dis-red" value="${esc(DI.red)}" /></div>
        <div class="field"><label>Fouls Committed</label><input class="input" type="number" min="0" id="pf-dis-fouls" value="${esc(DI.fouls)}" /></div>
        <div class="field"><label>Avg. Match Rating</label><input class="input" type="number" step="0.01" min="0" max="10" id="pf-form-avgRating" value="${esc(F.avgRating)}" /></div>
        <div class="field"><label>Man of the Match (count)</label><input class="input" type="number" min="0" id="pf-form-motmCount" value="${esc(F.motmCount)}" /></div>
      </div>
      </div>
    </details>

    <details class="form-section" id="pfs-team" ${detailsOpen(openTeam)}>
      <summary><span class="legend-icon">🏟️</span> Team Season &amp; Cup Competitions ${d.competitions.length ? `<span class="chip-count">${d.competitions.length}</span>` : ''}</summary>
      <div class="form-section-body">
      <div class="form-grid cols-4">
        <div class="field"><label>League Position</label><input class="input" type="number" min="1" id="pf-league-position" value="${esc(L.position)}" /></div>
        <div class="field"><label>Teams in League</label><input class="input" type="number" min="1" id="pf-league-leagueSize" value="${esc(L.leagueSize)}" /></div>
      </div>
      <div class="form-grid cols-2" style="margin-top:12px;">
        <div class="field checkbox-field"><input type="checkbox" id="pf-league-promoted" ${L.promoted ? 'checked' : ''} /><label for="pf-league-promoted">Promoted</label></div>
        <div class="field checkbox-field"><input type="checkbox" id="pf-league-relegated" ${L.relegated ? 'checked' : ''} /><label for="pf-league-relegated">Relegated</label></div>
      </div>
      <div class="repeat-list" id="repeat-pcompetitions" style="margin-top:14px;">${repeatRowsHTML('pcompetitions', d.competitions, playerCompetitionRowHTML)}</div>
      <button type="button" class="add-row-btn" data-action="add-row" data-repeat="pcompetitions">+ Add Competition</button>
      </div>
    </details>

    <details class="form-section" id="pfs-awards" ${detailsOpen(openAwards)}>
      <summary><span class="legend-icon">⭐</span> Individual Awards</summary>
      <div class="form-section-body">
      <div class="form-grid cols-2">
        <div class="field checkbox-field"><input type="checkbox" id="pf-aw-potsClub" ${AW.potsClub ? 'checked' : ''} /><label for="pf-aw-potsClub">Club Player of the Season</label></div>
        <div class="field checkbox-field"><input type="checkbox" id="pf-aw-yotsClub" ${AW.yotsClub ? 'checked' : ''} /><label for="pf-aw-yotsClub">Young Player of the Season</label></div>
        <div class="field checkbox-field"><input type="checkbox" id="pf-aw-teamOfSeason" ${AW.teamOfSeason ? 'checked' : ''} /><label for="pf-aw-teamOfSeason">Team of the Season</label></div>
        <div class="field checkbox-field"><input type="checkbox" id="pf-aw-goldenBoot" ${AW.goldenBoot ? 'checked' : ''} /><label for="pf-aw-goldenBoot">League Golden Boot</label></div>
        <div class="field checkbox-field"><input type="checkbox" id="pf-aw-goldenGlove" ${AW.goldenGlove ? 'checked' : ''} /><label for="pf-aw-goldenGlove">League Golden Glove</label></div>
        <div class="field"><label>Ballon d'Or Finish (e.g. 3rd)</label><input class="input" id="pf-aw-ballonDorRank" value="${esc(AW.ballonDorRank)}" /></div>
      </div>
      <div class="field field-full" style="margin-top:12px;"><label>Other Awards</label><textarea class="input" id="pf-aw-otherAwards" placeholder="Anything else worth noting...">${esc(AW.otherAwards)}</textarea></div>
      </div>
    </details>

    <details class="form-section" id="pfs-transfer" ${detailsOpen(openTransfer)}>
      <summary><span class="legend-icon">🔄</span> Transfer</summary>
      <div class="form-section-body">
      <div class="field checkbox-field" style="margin-bottom:12px;"><input type="checkbox" id="pf-tr-moved" ${TR.moved ? 'checked' : ''} /><label for="pf-tr-moved">Moved clubs this season</label></div>
      <div class="form-grid cols-4">
        <div class="field"><label>From Club</label><input class="input" id="pf-tr-fromClub" value="${esc(TR.fromClub)}" /></div>
        <div class="field"><label>To Club</label><input class="input" id="pf-tr-toClub" value="${esc(TR.toClub)}" /></div>
        <div class="field"><label>Fee (${appSettings.currency}M)</label><input class="input" type="number" step="0.1" min="0" id="pf-tr-fee" value="${esc(TR.fee)}" /></div>
        <div class="field"><label>Type</label>
          <select class="input select" id="pf-tr-type">
            ${TRANSFER_TYPES.map(t => `<option value="${t}" ${TR.type === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
      </div>
      </div>
    </details>

    <details class="form-section" id="pfs-contract" ${detailsOpen(openContract)}>
      <summary><span class="legend-icon">📄</span> Contract</summary>
      <div class="form-section-body">
      <div class="form-grid cols-4">
        <div class="field"><label>Weekly Wage (${appSettings.currency}k)</label><input class="input" type="number" step="0.1" id="pf-ct-wage" value="${esc(C.wage)}" /></div>
        <div class="field"><label>Years Remaining</label><input class="input" type="number" step="0.5" min="0" id="pf-ct-yearsRemaining" value="${esc(C.yearsRemaining)}" /></div>
        <div class="field"><label>Release Clause (${appSettings.currency}M)</label><input class="input" type="number" step="0.1" id="pf-ct-releaseClause" value="${esc(C.releaseClause)}" /></div>
      </div>
      </div>
    </details>

    <details class="form-section" id="pfs-international" ${detailsOpen(openIntl)}>
      <summary><span class="legend-icon">🌍</span> International Duty</summary>
      <div class="form-section-body">
      <div class="field checkbox-field" style="margin-bottom:12px;"><input type="checkbox" id="pf-intl-calledUp" ${I.calledUp ? 'checked' : ''} /><label for="pf-intl-calledUp">Called up this season</label></div>
      <div class="form-grid cols-4">
        <div class="field"><label>National Team</label><input class="input" id="pf-intl-team" value="${esc(I.team)}" /></div>
        <div class="field"><label>Caps</label><input class="input" type="number" min="0" id="pf-intl-caps" value="${esc(I.caps)}" /></div>
        <div class="field"><label>Goals</label><input class="input" type="number" min="0" id="pf-intl-goals" value="${esc(I.goals)}" /></div>
        <div class="field"><label>Tournament (if any)</label><input class="input" id="pf-intl-tournament" placeholder="e.g. World Cup" value="${esc(I.tournament)}" /></div>
      </div>
      <div class="field field-full" style="margin-top:12px;"><label>Tournament Result</label><input class="input" id="pf-intl-tournamentResult" placeholder="e.g. Reached the Final" value="${esc(I.tournamentResult)}" /></div>
      </div>
    </details>

    <details class="form-section" id="pfs-notes" ${detailsOpen(!!d.notes)}>
      <summary><span class="legend-icon">📝</span> Season Notes</summary>
      <div class="form-section-body">
      <textarea class="input" id="pf-notes" placeholder="Anything else worth remembering about this season...">${esc(d.notes)}</textarea>
      </div>
    </details>

    <div class="modal-footer-actions">
      <div>${editingPlayerSeasonId ? `<button type="button" class="btn btn-danger btn-sm" data-action="delete-player-season" data-id="${editingPlayerSeasonId}">Delete Season</button>` : '<span></span>'}</div>
      <div style="display:flex;gap:10px;">
        <button type="button" class="btn btn-ghost" data-action="close-season-modal">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Season</button>
      </div>
    </div>
  </form>`;
}

function collectPlayerSeasonFormIntoDraft() {
  const g = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  const gc = id => { const el = document.getElementById(id); return el ? el.checked : false; };
  const d = playerSeasonDraft;

  d.seasonLabel = g('pf-seasonLabel').trim();
  d.club = g('pf-club').trim();
  d.country = g('pf-country').trim();
  d.divisionTier = g('pf-divisionTier').trim();
  d.age = g('pf-age');
  d.shirtNumber = g('pf-shirtNumber');

  d.ratings = {
    overallStart: g('pf-rat-overallStart'), overallEnd: g('pf-rat-overallEnd'), potential: g('pf-rat-potential'),
    skillMoves: clamp(num(g('pf-rat-skillMoves'), 3), 1, 5), weakFoot: clamp(num(g('pf-rat-weakFoot'), 3), 1, 5)
  };
  d.appearances = {
    played: num(g('pf-app-played')), started: num(g('pf-app-started')),
    subApps: num(g('pf-app-subApps')), minutes: num(g('pf-app-minutes'))
  };
  d.attack = {
    goals: num(g('pf-atk-goals')), assists: num(g('pf-atk-assists')),
    shotsOnTarget: num(g('pf-atk-shotsOnTarget')), shotsTotal: num(g('pf-atk-shotsTotal')),
    keyPasses: num(g('pf-atk-keyPasses')), dribbles: num(g('pf-atk-dribbles'))
  };
  d.defending = { tackles: num(g('pf-def-tackles')), interceptions: num(g('pf-def-interceptions')), duelsWon: num(g('pf-def-duelsWon')) };
  d.goalkeeping = { saves: num(g('pf-gk-saves')), goalsConceded: num(g('pf-gk-goalsConceded')), cleanSheets: num(g('pf-gk-cleanSheets')) };
  d.discipline = { yellow: num(g('pf-dis-yellow')), red: num(g('pf-dis-red')), fouls: num(g('pf-dis-fouls')) };
  d.form = { avgRating: g('pf-form-avgRating'), motmCount: num(g('pf-form-motmCount')) };
  d.league = {
    position: g('pf-league-position') === '' ? '' : num(g('pf-league-position')),
    leagueSize: g('pf-league-leagueSize') === '' ? '' : num(g('pf-league-leagueSize')),
    promoted: gc('pf-league-promoted'), relegated: gc('pf-league-relegated')
  };
  d.awards = {
    potsClub: gc('pf-aw-potsClub'), yotsClub: gc('pf-aw-yotsClub'), teamOfSeason: gc('pf-aw-teamOfSeason'),
    goldenBoot: gc('pf-aw-goldenBoot'), goldenGlove: gc('pf-aw-goldenGlove'),
    ballonDorRank: g('pf-aw-ballonDorRank').trim(), otherAwards: g('pf-aw-otherAwards').trim()
  };
  d.transfer = {
    moved: gc('pf-tr-moved'), fromClub: g('pf-tr-fromClub').trim(), toClub: g('pf-tr-toClub').trim(),
    fee: g('pf-tr-fee'), type: g('pf-tr-type')
  };
  d.contract = { wage: g('pf-ct-wage'), yearsRemaining: g('pf-ct-yearsRemaining'), releaseClause: g('pf-ct-releaseClause') };
  d.international = {
    calledUp: gc('pf-intl-calledUp'), team: g('pf-intl-team').trim(), caps: num(g('pf-intl-caps')), goals: num(g('pf-intl-goals')),
    tournament: g('pf-intl-tournament').trim(), tournamentResult: g('pf-intl-tournamentResult').trim()
  };
  d.notes = g('pf-notes').trim();
  return d;
}

function savePlayerSeasonDraft() {
  collectPlayerSeasonFormIntoDraft();
  if (!playerSeasonDraft.seasonLabel || !playerSeasonDraft.club) {
    toast('Season and club are required', 'danger');
    focusFieldErrors(
      !playerSeasonDraft.seasonLabel ? 'pf-seasonLabel' : null,
      !playerSeasonDraft.club ? 'pf-club' : null
    );
    return;
  }
  const idx = pState.seasons.findIndex(s => s.id === playerSeasonDraft.id);
  if (idx >= 0) pState.seasons[idx] = playerSeasonDraft;
  else pState.seasons.push(playerSeasonDraft);
  savePlayerState();
  closeSeasonModal();
  toast('Season saved');
  renderCurrentTab();
}

function deletePlayerSeason(id) {
  pState.seasons = pState.seasons.filter(s => s.id !== id);
  savePlayerState();
  toast('Season deleted', 'danger');
  if (!$('#season-modal').hidden) closeSeasonModal();
  renderCurrentTab();
}

/* ---------------- Import / Export ---------------- */

function backupStatusLine() {
  if (!appSettings.lastBackupAt) return 'You have never exported a backup.';
  return `Last backup: ${timeAgo(appSettings.lastBackupAt)}.`;
}

// Shared by both Manager and Player Settings — a JSON file is the most
// reliable way to move a save, but pulling up a Files app or Downloads
// folder is real friction on a phone. A code you can select and paste
// directly between two open tabs/apps sidesteps that.
function transferCodeSettingsHTML() {
  return `
      <div class="settings-row" style="flex-direction:column;align-items:stretch;">
        <div class="settings-row-text"><h4>Transfer Code</h4><p>Move this save to another device without a file — generate a code here, then paste it into "Import Transfer Code" on the other device.</p></div>
        <div style="display:flex;gap:10px;margin-top:8px;">
          <button class="btn btn-ghost" data-action="generate-transfer-code">Generate Code</button>
        </div>
      </div>
      <div class="settings-row" id="transfer-code-out-row" style="flex-direction:column;align-items:stretch;" hidden>
        <div class="settings-row-text">
          <label>Your Transfer Code</label>
          <textarea class="input" id="transfer-code-output" readonly rows="3" data-action="select-transfer-code-output"></textarea>
        </div>
        <button class="btn btn-ghost" style="align-self:flex-start;margin-top:8px;" data-action="copy-transfer-code">Copy Code</button>
      </div>
      <div class="settings-row" style="flex-direction:column;align-items:stretch;">
        <div class="settings-row-text">
          <label>Import Transfer Code</label>
          <textarea class="input" id="transfer-code-input" rows="3" placeholder="Paste a transfer code here"></textarea>
        </div>
        <button class="btn btn-ghost" style="align-self:flex-start;margin-top:8px;" data-action="import-transfer-code">Import Code</button>
      </div>`;
}

function exportJSON() {
  const mode = appSettings.mode;
  const active = mode === 'player' ? pState : state;
  const exportObj = mode === 'player'
    ? { player: active.player, seasons: active.seasons }
    : { manager: active.manager, seasons: active.seasons };
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const nameSrc = mode === 'player' ? active.player.name : active.manager.name;
  const safeName = (nameSrc || (mode === 'player' ? 'player-save' : 'manager-save')).replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  a.href = url;
  a.download = `${safeName}-${mode}-save.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  appSettings.lastBackupAt = Date.now();
  saveAppSettings();
  hideBackupNudge();
  toast('Exported save data');
}

/* ---------------- Backup nudge ---------------- */

const BACKUP_NUDGE_INTERVAL = 14 * 86400000; // remind every 14 days without a backup
const BACKUP_NUDGE_SNOOZE = 7 * 86400000;    // "Later" waits a week before asking again

// Everything in this app lives in localStorage only — there's no account or
// cloud sync, so a cleared cache, browser reset, or device change silently
// wipes a save with no way back short of a JSON export the user made
// themselves. This nudges toward that habit without nagging: only once data
// actually exists to lose, never more than every two weeks, and a "Later"
// tap buys a full extra week of silence.
function maybeShowBackupNudge() {
  const hasData = (state && state.seasons && state.seasons.length) || (pState && pState.seasons && pState.seasons.length);
  if (!hasData) return;
  const now = Date.now();
  if (appSettings.backupNudgeSnoozedUntil && now < appSettings.backupNudgeSnoozedUntil) return;
  const sinceBackup = appSettings.lastBackupAt ? now - appSettings.lastBackupAt : Infinity;
  if (sinceBackup < BACKUP_NUDGE_INTERVAL) return;
  showBackupNudge();
}

function showBackupNudge() {
  const el = $('#backup-nudge');
  if (!el) return;
  el.hidden = false;
}

function hideBackupNudge() {
  const el = $('#backup-nudge');
  if (el) el.hidden = true;
}

function snoozeBackupNudge() {
  appSettings.backupNudgeSnoozedUntil = Date.now() + BACKUP_NUDGE_SNOOZE;
  saveAppSettings();
  hideBackupNudge();
}

// Shared by both file-based import and transfer-code import below — takes
// an already-parsed plain object and applies it to whichever mode is
// currently active. Assumed valid; callers are responsible for validating
// `parsed` first so a bad payload here fails loudly instead of half-applying.
function applyImportedSaveData(parsed) {
  const mode = appSettings.mode;
  if (mode === 'player') {
    pState.player = Object.assign(emptyPlayerProfile(), parsed.player || {});
    pState.seasons = Array.isArray(parsed.seasons) ? parsed.seasons.map(s => Object.assign(emptyPlayerSeason(), s)) : [];
    savePlayerState();
  } else {
    state.manager = Object.assign(emptyManagerProfile(), parsed.manager || {});
    state.seasons = Array.isArray(parsed.seasons) ? parsed.seasons.map(s => Object.assign(emptySeason(), s)) : [];
    saveState();
  }
  // Data is already persisted at this point — a render hiccup afterwards
  // isn't an import failure, so it gets its own message rather than the
  // contradictory "imported" + "failed" pair a shared catch would produce.
  try {
    renderCurrentTab();
    toast('Save data imported');
  } catch (e) {
    toast('Data imported, but the view failed to refresh — try reloading', 'danger');
  }
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || typeof parsed !== 'object') throw new Error('Invalid file');
      applyImportedSaveData(parsed);
    } catch (e) {
      toast('Import failed — invalid JSON file', 'danger');
    }
  };
  reader.readAsText(file);
}

/* ---------------- Cross-device transfer codes ---------------- */

// A compact, copy-pasteable stand-in for real cloud sync: everything here
// lives in localStorage with no account or server behind it, so moving a
// save to another device/browser means physically carrying the data over
// yourself. JSON export already does that via a file; this covers the case
// where shuffling a file between two devices is more friction than just
// selecting and pasting a block of text (e.g. phone to phone).
const TRANSFER_CODE_PREFIX = 'FCTC1:';

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function base64ToUtf8(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function generateTransferCode() {
  const mode = appSettings.mode;
  const active = mode === 'player' ? pState : state;
  const payload = mode === 'player'
    ? { player: active.player, seasons: active.seasons }
    : { manager: active.manager, seasons: active.seasons };
  return TRANSFER_CODE_PREFIX + utf8ToBase64(JSON.stringify(payload));
}

function importTransferCode(code) {
  let parsed;
  try {
    const trimmed = (code || '').trim();
    if (!trimmed.startsWith(TRANSFER_CODE_PREFIX)) throw new Error('Not a transfer code');
    parsed = JSON.parse(base64ToUtf8(trimmed.slice(TRANSFER_CODE_PREFIX.length)));
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid code');
  } catch (e) {
    toast('Import failed — invalid or corrupted transfer code', 'danger');
    return;
  }
  applyImportedSaveData(parsed);
}

/* ---------------- Theme ---------------- */

function applyTheme() {
  const theme = appSettings.theme;
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}

function applyLayout(layout) {
  appSettings.layout = layout === 'mobile' ? 'mobile' : 'desktop';
  saveAppSettings();
  document.documentElement.setAttribute('data-layout', appSettings.layout);
  syncMobileNavClones();
}

function syncMobileNavClones() {
  const tabs = $('#main-tabs'), mobileTabs = $('#mobile-tabbar');
  if (tabs && mobileTabs) mobileTabs.innerHTML = tabs.innerHTML;
  const modeSwitch = $('#mode-switch'), mobileModeSwitch = $('#mode-switch-mobile');
  if (modeSwitch && mobileModeSwitch) mobileModeSwitch.innerHTML = modeSwitch.innerHTML;
}

/* ---------------- Event wiring ---------------- */

function wireEvents() {
  // Delegated on document so this covers both the sidebar nav and the
  // cloned mobile-mode bottom tab bar / mode switch without duplicate listeners.
  document.addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (btn) switchTab(btn.dataset.tab);
  });

  function openSidebar() { $('#sidebar').classList.add('open'); $('#sidebar-backdrop').classList.add('open'); }
  function closeSidebar() { $('#sidebar').classList.remove('open'); $('#sidebar-backdrop').classList.remove('open'); }
  $('#mobile-nav-toggle').addEventListener('click', openSidebar);
  $('#mobile-nav-close').addEventListener('click', closeSidebar);
  $('#sidebar-backdrop').addEventListener('click', closeSidebar);

  document.addEventListener('click', e => {
    const btn = e.target.closest('.mode-switch-btn');
    if (btn) switchMode(btn.dataset.mode);
  });

  $('#fab-add-season').addEventListener('click', () => openAnySeasonModal());

  function openAnySeasonModal() { appSettings.mode === 'player' ? openPlayerSeasonModal(null) : openSeasonModal(null); }
  $('#add-season-btn').addEventListener('click', openAnySeasonModal);
  $('#add-season-btn-side').addEventListener('click', openAnySeasonModal);

  $('#season-modal-close').addEventListener('click', closeSeasonModal);
  $('#season-modal').addEventListener('click', e => { if (e.target.id === 'season-modal') closeSeasonModal(); });

  $('#save-manager-close').addEventListener('click', closeSaveManagerModal);
  $('#save-manager-modal').addEventListener('click', e => { if (e.target.id === 'save-manager-modal') closeSaveManagerModal(); });

  $('#confirm-modal-cancel').addEventListener('click', closeConfirmModal);
  $('#confirm-modal-ok').addEventListener('click', () => {
    const fn = confirmAction;
    closeConfirmModal();
    if (fn) fn();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!$('#confirm-modal').hidden) closeConfirmModal();
      else if (!$('#season-modal').hidden) closeSeasonModal();
      else if (!$('#save-manager-modal').hidden) closeSaveManagerModal();
    }
  });

  // Delegated clicks (actions across the whole app)
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const action = t.dataset.action;

    if (action === 'open-add-season') openSeasonModal(null);
    else if (action === 'open-add-player-season') openPlayerSeasonModal(null);
    else if (action === 'close-season-modal') closeSeasonModal();
    else if (action === 'edit-season') {
      const s = state.seasons.find(s => s.id === t.dataset.id);
      if (s) openSeasonModal(s);
    } else if (action === 'duplicate-season') {
      duplicateSeasonAsTemplate(t.dataset.id);
    } else if (action === 'delete-season') {
      const s = state.seasons.find(s => s.id === t.dataset.id);
      confirmDialog(`Delete ${s ? s.seasonLabel + ' at ' + s.club : 'this season'}? This cannot be undone.`, () => deleteSeason(t.dataset.id));
    } else if (action === 'edit-player-season') {
      const s = pState.seasons.find(s => s.id === t.dataset.id);
      if (s) openPlayerSeasonModal(s);
    } else if (action === 'duplicate-player-season') {
      duplicatePlayerSeasonAsTemplate(t.dataset.id);
    } else if (action === 'delete-player-season') {
      const s = pState.seasons.find(s => s.id === t.dataset.id);
      confirmDialog(`Delete ${s ? s.seasonLabel + ' at ' + s.club : 'this season'}? This cannot be undone.`, () => deletePlayerSeason(t.dataset.id));
    } else if (action === 'add-row') {
      const kind = t.dataset.repeat;
      if (kind === 'pcompetitions') {
        playerSeasonDraft.competitions.push(emptyPlayerCompetition());
        reRenderPlayerRepeatSection('pcompetitions');
      } else if (kind === 'pmatches') {
        playerSeasonDraft.matches.push(emptyPlayerMatch());
        reRenderPlayerRepeatSection('pmatches');
      } else {
        const factory = kind === 'competitions' ? emptyCompetition
          : kind === 'boardObjectives' ? emptyObjective
          : kind === 'matches' ? emptyMatch
          : emptyTransfer;
        seasonDraft[kind].push(factory());
        reRenderRepeatSection(kind);
      }
    } else if (action === 'remove-row') {
      const kind = t.dataset.repeat, idx = parseInt(t.dataset.index, 10);
      if (kind === 'pcompetitions') {
        playerSeasonDraft.competitions.splice(idx, 1);
        reRenderPlayerRepeatSection('pcompetitions');
      } else if (kind === 'pmatches') {
        playerSeasonDraft.matches.splice(idx, 1);
        reRenderPlayerRepeatSection('pmatches');
      } else {
        seasonDraft[kind].splice(idx, 1);
        reRenderRepeatSection(kind);
      }
    } else if (action === 'jump-section') {
      const target = document.getElementById(t.dataset.target);
      if (target) {
        if (target.tagName === 'DETAILS') target.open = true;
        t.blur();
        requestAnimationFrame(() => {
          target.scrollIntoView({ behavior: 'auto', block: 'start' });
        });
      }
    } else if (action === 'open-save-manager') {
      openSaveManagerModal();
    } else if (action === 'save-profile') {
      state.manager.name = $('#f-mgr-name').value.trim();
      state.manager.nationality = $('#f-mgr-nat').value.trim();
      state.manager.startingClub = $('#f-mgr-club').value.trim();
      state.manager.careerStartYear = $('#f-mgr-year').value.trim();
      saveState();
      toast('Profile saved');
      updateHeaderSubtitle();
    } else if (action === 'save-player-profile') {
      pState.player.name = $('#pf-plr-name').value.trim();
      pState.player.nationality = $('#pf-plr-nat').value.trim();
      pState.player.position = $('#pf-plr-position').value;
      pState.player.startingClub = $('#pf-plr-club').value.trim();
      pState.player.careerStartYear = $('#pf-plr-year').value.trim();
      savePlayerState();
      toast('Profile saved');
      updateHeaderSubtitle();
    } else if (action === 'export-json') {
      exportJSON();
    } else if (action === 'backup-nudge-export') {
      exportJSON();
    } else if (action === 'backup-nudge-dismiss') {
      snoozeBackupNudge();
    } else if (action === 'select-transfer-code-output') {
      t.select();
    } else if (action === 'generate-transfer-code') {
      const code = generateTransferCode();
      const outputEl = $('#transfer-code-output');
      if (outputEl) outputEl.value = code;
      const outRow = $('#transfer-code-out-row');
      if (outRow) outRow.hidden = false;
      toast('Transfer code generated below');
    } else if (action === 'copy-transfer-code') {
      const outputEl = $('#transfer-code-output');
      if (outputEl && outputEl.value) {
        navigator.clipboard.writeText(outputEl.value)
          .then(() => toast('Transfer code copied'))
          .catch(() => toast('Could not copy — select the text and copy manually', 'danger'));
      }
    } else if (action === 'import-transfer-code') {
      const inputEl = $('#transfer-code-input');
      const code = inputEl ? inputEl.value : '';
      if (!code.trim()) { toast('Paste a transfer code first', 'danger'); return; }
      importTransferCode(code);
      if (inputEl) inputEl.value = '';
    } else if (action === 'reset-all') {
      const mode = appSettings.mode;
      const label = mode === 'player' ? 'this player save' : 'this manager save';
      confirmDialog(`Reset ${label}? The profile and every season in it will be permanently cleared. This cannot be undone.`, () => {
        if (mode === 'player') {
          const keepId = pState.id, keepName = pState.name;
          pState = Object.assign({ id: keepId, name: keepName, createdAt: pState.createdAt, updatedAt: Date.now() }, emptyPlayerSaveData());
          savePlayerState();
        } else {
          const keepId = state.id, keepName = state.name;
          state = Object.assign({ id: keepId, name: keepName, createdAt: state.createdAt, updatedAt: Date.now() }, emptyManagerSaveData());
          saveState();
        }
        toast('Save data reset', 'danger');
        switchTab(mode === 'player' ? 'p-dashboard' : 'dashboard');
      });
    } else if (action === 'switch-save') {
      switchToSave(saveManagerMode, t.dataset.id);
    } else if (action === 'rename-save') {
      startInlineRename(t.dataset.id);
    } else if (action === 'duplicate-save') {
      const copy = duplicateSave(saveManagerMode, t.dataset.id);
      if (copy) { toast('Save duplicated'); renderSaveManagerList($('#save-manager-search') ? $('#save-manager-search').value : ''); }
    } else if (action === 'delete-save') {
      const mode = saveManagerMode;
      const saves = loadSaves(mode);
      if (saves.length <= 1) { toast('You need at least one save — create another before deleting this one', 'danger'); return; }
      const target = saves.find(s => s.id === t.dataset.id);
      confirmDialog(`Delete "${target ? saveDisplayName(mode, target) : 'this save'}"? This cannot be undone.`, () => {
        deleteSaveSlot(mode, t.dataset.id);
        if (mode === 'manager') state = getActiveSave('manager'); else pState = getActiveSave('player');
        toast('Save deleted', 'danger');
        renderSaveManagerList($('#save-manager-search') ? $('#save-manager-search').value : '');
        renderCurrentTab();
      });
    } else if (action === 'create-save') {
      const nameInput = $('#save-manager-new-name');
      const save = createSave(saveManagerMode, nameInput ? nameInput.value : '');
      if (save) {
        switchToSave(saveManagerMode, save.id);
        toast('Save created');
        switchTab(saveManagerMode === 'player' ? 'p-dashboard' : 'dashboard');
      }
    }
  });

  // Delegated input changes inside repeat rows (season form)
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.matches('[data-repeat][data-field]')) {
      const kind = t.dataset.repeat, idx = parseInt(t.dataset.index, 10), field = t.dataset.field;
      const draft = (kind === 'pcompetitions' || kind === 'pmatches') ? playerSeasonDraft : seasonDraft;
      const key = kind === 'pcompetitions' ? 'competitions' : kind === 'pmatches' ? 'matches' : kind;
      if (!draft || !draft[key] || !draft[key][idx]) return;
      draft[key][idx][field] = t.type === 'checkbox' ? t.checked : t.value;
      // The W/D/L badge is derived from gf/ga, not stored — patch just this
      // row's badge in place rather than re-rendering the whole list, which
      // would drop focus out of the input on every keystroke.
      if ((kind === 'matches' || kind === 'pmatches') && (field === 'gf' || field === 'ga')) {
        const row = t.closest('.repeat-row');
        const badgeEl = row && row.querySelector('.match-result-field');
        if (badgeEl) badgeEl.innerHTML = matchResultBadgeHTML(draft[key][idx].gf, draft[key][idx].ga);
      }
    }
    if (t.id === 'save-manager-search') refreshSaveListOnly(t.value);
  });

  $('#save-manager-body').addEventListener('keydown', e => {
    if (e.target.id === 'save-manager-new-name' && e.key === 'Enter') {
      e.preventDefault();
      $('#save-manager-create-btn').click();
    }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.matches('[data-repeat][data-field][type="checkbox"]')) {
      const kind = t.dataset.repeat, idx = parseInt(t.dataset.index, 10), field = t.dataset.field;
      const draft = kind === 'pcompetitions' ? playerSeasonDraft : seasonDraft;
      const key = kind === 'pcompetitions' ? 'competitions' : kind;
      if (!draft || !draft[key] || !draft[key][idx]) return;
      draft[key][idx][field] = t.checked;
    }
    if (t.id === 'theme-toggle' || t.closest?.('#theme-toggle')) return;
  });

  $('#season-form-body').addEventListener('submit', e => {
    if (e.target.id === 'season-form') { e.preventDefault(); saveSeasonDraft(); }
    else if (e.target.id === 'player-season-form') { e.preventDefault(); savePlayerSeasonDraft(); }
  });

  // Quicknav scroll-spy inside the season modal
  let spyPending = false;
  $('#season-modal').addEventListener('scroll', () => {
    if (spyPending) return;
    spyPending = true;
    requestAnimationFrame(() => {
      spyPending = false;
      let currentId = null;
      const sections = seasonModalMode === 'player' ? PLAYER_SEASON_SECTIONS : SEASON_SECTIONS;
      sections.forEach(s => {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top - 150 <= 0) currentId = s.id;
      });
      $$('.quicknav-pill').forEach(p => p.classList.toggle('active', p.dataset.target === currentId));
    });
  });

  // Seasons tab controls
  $('#season-search').addEventListener('input', renderSeasons);
  $('#season-sort').addEventListener('change', renderSeasons);
  $('#p-season-search').addEventListener('input', renderPlayerSeasons);
  $('#p-season-sort').addEventListener('change', renderPlayerSeasons);

  // Settings tab (delegated because content is re-rendered)
  document.addEventListener('click', e => {
    const btn = e.target.closest('.theme-toggle button');
    if (btn) {
      appSettings.theme = btn.dataset.theme;
      saveAppSettings();
      applyTheme();
      renderCurrentTab();
    }
  });
  document.addEventListener('click', e => {
    const btn = e.target.closest('.layout-toggle button');
    if (btn) {
      applyLayout(btn.dataset.layout);
      renderCurrentTab();
    }
  });
  document.addEventListener('click', e => {
    const btn = e.target.closest('.quality-toggle button');
    if (btn) {
      appSettings.renderQuality = btn.dataset.quality;
      saveAppSettings();
      if (window.Trophy3D) window.Trophy3D.setQuality(appSettings.renderQuality);
      renderCurrentTab();
    }
  });
  document.addEventListener('click', e => {
    const btn = e.target.closest('.save-manager-view-toggle button');
    if (btn) {
      saveManagerView = btn.dataset.view;
      renderSaveManagerList();
    }
  });
  document.addEventListener('change', e => {
    if (e.target.matches('.currency-select')) {
      appSettings.currency = e.target.value;
      saveAppSettings();
      toast('Currency updated');
      renderCurrentTab();
    }
    if (e.target.matches('.import-file-input') && e.target.files[0]) {
      importJSON(e.target.files[0]);
      e.target.value = '';
    }
  });
}

/* ---------------- Init ---------------- */

/* ---------------- PWA: service worker + install prompt ---------------- */

let deferredInstallPrompt = null;

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return; // skip on file:// (Electron)
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support best-effort only */ });
  });
}

function wireInstallPrompt() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    $$('.install-app-row').forEach(row => row.hidden = false);
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    $$('.install-app-row').forEach(row => row.hidden = true);
    toast('App installed');
  });
  document.addEventListener('click', async e => {
    if (!e.target.closest('.install-app-btn')) return;
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $$('.install-app-row').forEach(row => row.hidden = true);
  });
}

function init() {
  state = getActiveSave('manager');
  pState = getActiveSave('player');
  applyTheme();
  document.documentElement.setAttribute('data-app-mode', appSettings.mode);
  document.documentElement.setAttribute('data-layout', appSettings.layout);
  $$('.mode-switch-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === appSettings.mode));
  syncMobileNavClones();
  wireEvents();
  registerServiceWorker();
  wireInstallPrompt();
  if (window.Trophy3D) window.Trophy3D.setQuality(appSettings.renderQuality);
  else window.addEventListener('trophy3d-ready', () => window.Trophy3D.setQuality(appSettings.renderQuality), { once: true });
  switchTab(appSettings.mode === 'player' ? 'p-dashboard' : 'dashboard');
  applyLaunchShortcut();
  maybeShowBackupNudge();
}

// Handles PWA manifest "shortcuts" (long-press the home-screen icon) —
// a shortcut that doesn't actually do anything on launch is worse than not
// offering one, so this turns the URL param into the real action.
function applyLaunchShortcut() {
  const params = new URLSearchParams(location.search);
  const shortcut = params.get('shortcut');
  if (!shortcut) return;
  if (shortcut === 'add-season') {
    if (appSettings.mode === 'player') openPlayerSeasonModal(null); else openSeasonModal(null);
  } else if (shortcut === 'trophies') {
    switchTab(appSettings.mode === 'player' ? 'p-honours' : 'trophies');
  }
  history.replaceState(null, '', location.pathname);
}

document.addEventListener('DOMContentLoaded', init);
