'use strict';

/* ===========================================================
   FC Career Tracker — application logic
   Single-file, no build step, persists to localStorage.
   =========================================================== */

/* ---------------- Constants ---------------- */

const STORAGE_KEY = 'fc-career-tracker:v1';

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

function defaultState() {
  return {
    manager: { name: '', nationality: '', startingClub: '', careerStartYear: '' },
    settings: { theme: 'dark', currency: '£' },
    seasons: []
  };
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

/* ---------------- Storage ---------------- */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultState(), parsed, {
      manager: Object.assign(defaultState().manager, parsed.manager || {}),
      settings: Object.assign(defaultState().settings, parsed.settings || {}),
      seasons: Array.isArray(parsed.seasons) ? parsed.seasons : []
    });
  } catch (e) {
    console.error('Failed to load state', e);
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------------- Global runtime state ---------------- */

let state = loadState();
let currentTab = 'dashboard';
let seasonDraft = null;
let editingSeasonId = null;
let confirmAction = null;

/* ---------------- Trophy / stat computation ---------------- */

function seasonTrophyList(season) {
  const trophies = [];
  if (num(season.league.position) === 1 && season.league.position !== '') {
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
  const currency = state.settings.currency;

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
      trophiesByName[t.name] = trophiesByName[t.name] || { count: 0, entries: [] };
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

  let bestSeason = null, bestScore = -1;
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
    finances: { spend, income, net: income - spend, prizeMoneyTotal, transfersInCount, transfersOutCount },
    clubHistory,
    bestSeason,
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

/* ---------------- Confirm modal ---------------- */

function confirmDialog(text, onConfirm) {
  $('#confirm-modal-text').textContent = text;
  confirmAction = onConfirm;
  $('#confirm-modal').hidden = false;
}
function closeConfirmModal() {
  $('#confirm-modal').hidden = true;
  confirmAction = null;
}

/* ---------------- Tabs / routing ---------------- */

const TAB_TITLES = {
  dashboard: 'Dashboard', seasons: 'Seasons', totals: 'Career Totals',
  trophies: 'Trophy Cabinet', transfers: 'Transfers', settings: 'Settings'
};

function switchTab(tab) {
  currentTab = tab;
  $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.view').forEach(v => v.classList.remove('active'));
  $('#view-' + tab).classList.add('active');
  $('#sidebar').classList.remove('open');
  $('#sidebar-backdrop').classList.remove('open');
  $('#page-title').textContent = TAB_TITLES[tab] || 'FC Career Tracker';
  renderCurrentTab();
  $('#app-main').scrollTop = 0;
  window.scrollTo({ top: 0 });
}

function renderCurrentTab() {
  if (currentTab === 'dashboard') renderDashboard();
  else if (currentTab === 'seasons') renderSeasons();
  else if (currentTab === 'totals') renderTotals();
  else if (currentTab === 'trophies') renderTrophies();
  else if (currentTab === 'transfers') renderTransfers();
  else if (currentTab === 'settings') renderSettings();
  updateHeaderSubtitle();
}

function updateHeaderSubtitle() {
  const subEl = $('#manager-subtitle');
  const nameEl = $('#manager-mini-name');
  const avatarEl = $('#manager-avatar');
  const totals = computeCareerTotals();

  if (state.manager.name) {
    nameEl.textContent = state.manager.name;
    avatarEl.textContent = state.manager.name.trim().slice(0, 2) || '?';
  } else {
    nameEl.textContent = 'Set up profile';
    avatarEl.textContent = '?';
  }

  if (!state.manager.name && !state.seasons.length) {
    subEl.textContent = 'Tap to configure';
    return;
  }
  const parts = [];
  if (totals.totalSeasons) parts.push(totals.totalSeasons + ' season' + (totals.totalSeasons === 1 ? '' : 's'));
  if (totals.totalTrophies) parts.push(totals.totalTrophies + ' trophies');
  const latest = totals.seasonsChrono[totals.seasonsChrono.length - 1];
  if (latest) parts.push('at ' + (latest.club || '—'));
  subEl.textContent = parts.join(' · ') || 'Tap to configure';
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
  const currency = state.settings.currency;

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
      <div class="season-card-trophies">${trophies.map(tr => `<span class="trophy-chip">🏆 ${esc(tr.name)}</span>`).join('') || '<span class="hint">No trophies</span>'}</div>
      <div class="season-card-actions">
        <button class="btn btn-ghost btn-sm btn-icon" data-action="edit-season" data-id="${s.id}" title="Edit">✎</button>
        <button class="btn btn-ghost btn-sm btn-icon" data-action="delete-season" data-id="${s.id}" title="Delete">🗑</button>
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
  const currency = state.settings.currency;

  const trophyRows = Object.entries(t.trophiesByName).sort((a, b) => b[1].count - a[1].count).map(([name, d]) =>
    `<tr><td>${esc(name)}</td><td>${d.count}</td><td>${d.entries.map(e => esc(e.season)).join(', ')}</td></tr>`
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

function trophyEmoji(name) {
  const n = name.toLowerCase();
  if (n.includes('title') || n.includes('league')) return '👑';
  if (n.includes('champions league')) return '🏆';
  if (n.includes('super cup') || n.includes('shield')) return '🛡️';
  if (n.includes('world cup')) return '🌍';
  return '🏆';
}

function renderTrophies() {
  const el = $('#trophies-content');
  const t = computeCareerTotals();
  const entries = Object.entries(t.trophiesByName).sort((a, b) => b[1].count - a[1].count);

  el.innerHTML = `
    <div class="view-header">
      <div class="hint">${t.totalTrophies} ${t.totalTrophies === 1 ? 'trophy' : 'trophies'} won across ${t.totalSeasons} season${t.totalSeasons === 1 ? '' : 's'}</div>
    </div>
    ${entries.length ? `<div class="trophy-grid">
      ${entries.map(([name, d]) => `
        <div class="trophy-card">
          <div class="trophy-emoji">${trophyEmoji(name)}</div>
          <div class="trophy-count">×${d.count}</div>
          <div class="trophy-name">${esc(name)}</div>
          <div class="trophy-list-detail">${d.entries.map(e => `${esc(e.season)} (${esc(e.club)})`).join('<br>')}</div>
        </div>`).join('')}
    </div>` : `<div class="empty-state card card-pad"><div class="empty-icon">🏆</div><h3>Trophy cabinet is empty</h3><p>Win a league title or cup and it'll show up here.</p></div>`}
  `;
}

/* ---------------- Transfers tab ---------------- */

function renderTransfers() {
  const el = $('#transfers-content');
  const seasons = sortedSeasons(state.seasons, 'newest');
  const currency = state.settings.currency;

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
  const m = state.manager, s = state.settings;
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
      <div class="settings-row">
        <div class="settings-row-text"><h4>Theme</h4><p>Choose how the tracker looks.</p></div>
        <div class="theme-toggle" id="theme-toggle">
          <button data-theme="dark" class="${s.theme === 'dark' ? 'active' : ''}">Dark</button>
          <button data-theme="light" class="${s.theme === 'light' ? 'active' : ''}">Light</button>
          <button data-theme="system" class="${s.theme === 'system' ? 'active' : ''}">System</button>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-text"><h4>Currency</h4><p>Used for transfer fees, budgets and prize money.</p></div>
        <select class="input select" id="f-currency" style="width:120px;">
          <option value="£" ${s.currency === '£' ? 'selected' : ''}>£ GBP</option>
          <option value="€" ${s.currency === '€' ? 'selected' : ''}>€ EUR</option>
          <option value="$" ${s.currency === '$' ? 'selected' : ''}>$ USD</option>
        </select>
      </div>
      <div class="settings-row">
        <div class="settings-row-text"><h4>Export Data</h4><p>Download your full career as a JSON backup file.</p></div>
        <button class="btn btn-ghost" data-action="export-json">Export JSON</button>
      </div>
      <div class="settings-row">
        <div class="settings-row-text"><h4>Import Data</h4><p>Restore from a previously exported JSON backup. This replaces current data.</p></div>
        <label class="btn btn-ghost" style="cursor:pointer;">Import JSON<input type="file" id="import-file-input" accept="application/json" style="display:none;" /></label>
      </div>
      <div class="settings-row">
        <div class="settings-row-text"><h4>Reset All Data</h4><p>Permanently delete your manager profile and every season. Cannot be undone.</p></div>
        <button class="btn btn-danger" data-action="reset-all">Reset Everything</button>
      </div>
    </div>
  `;
}

/* ---------------- Season form (add/edit modal) ---------------- */

function openSeasonModal(season) {
  seasonDraft = season ? deepClone(season) : emptySeason();
  editingSeasonId = season ? season.id : null;
  $('#season-modal-title').textContent = season ? `Edit Season — ${season.seasonLabel || ''} ${season.club || ''}` : 'Add Season';
  $('#season-form-body').innerHTML = renderSeasonFormHTML(seasonDraft, !!season);
  $('#season-modal').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeSeasonModal() {
  $('#season-modal').hidden = true;
  document.body.style.overflow = '';
  seasonDraft = null;
  editingSeasonId = null;
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
    <button type="button" class="remove-row-btn" data-action="remove-row" data-repeat="competitions" data-index="${i}" title="Remove">✕</button>
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
    <div class="field"><label>Fee (${state.settings.currency}M)</label><input class="input" type="number" step="0.1" min="0" data-repeat="${kind}" data-index="${i}" data-field="fee" value="${esc(tr.fee)}" /></div>
    <button type="button" class="remove-row-btn" data-action="remove-row" data-repeat="${kind}" data-index="${i}" title="Remove">✕</button>
  </div>`;
}

function objectiveRowHTML(o, i) {
  return `<div class="repeat-row">
    <div class="field" style="flex-basis: 280px;"><label>Objective</label><input class="input" data-repeat="boardObjectives" data-index="${i}" data-field="description" value="${esc(o.description)}" placeholder="e.g. Finish top half" /></div>
    <div class="field checkbox-field" style="flex-basis:120px;align-self:end;padding-bottom:9px;">
      <input type="checkbox" id="obj-ach-${i}" data-repeat="boardObjectives" data-index="${i}" data-field="achieved" ${o.achieved ? 'checked' : ''} />
      <label for="obj-ach-${i}">Achieved</label>
    </div>
    <button type="button" class="remove-row-btn" data-action="remove-row" data-repeat="boardObjectives" data-index="${i}" title="Remove">✕</button>
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
      <summary><span class="legend-icon">💰</span> Finances (${state.settings.currency}M)</summary>
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
  const fn = kind === 'competitions' ? competitionRowHTML : kind === 'boardObjectives' ? objectiveRowHTML : transferRowHTML;
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

/* ---------------- Import / Export ---------------- */

function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (state.manager.name || 'fc-career').replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  a.href = url;
  a.download = `${safeName}-career-tracker.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Exported career data');
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || typeof parsed !== 'object') throw new Error('Invalid file');
      state = Object.assign(defaultState(), parsed, {
        manager: Object.assign(defaultState().manager, parsed.manager || {}),
        settings: Object.assign(defaultState().settings, parsed.settings || {}),
        seasons: Array.isArray(parsed.seasons) ? parsed.seasons : []
      });
      saveState();
      applyTheme();
      toast('Career data imported');
      renderCurrentTab();
    } catch (e) {
      toast('Import failed — invalid JSON file', 'danger');
    }
  };
  reader.readAsText(file);
}

/* ---------------- Theme ---------------- */

function applyTheme() {
  const theme = state.settings.theme;
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}

/* ---------------- Event wiring ---------------- */

function wireEvents() {
  $('#main-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (btn) switchTab(btn.dataset.tab);
  });

  function openSidebar() { $('#sidebar').classList.add('open'); $('#sidebar-backdrop').classList.add('open'); }
  function closeSidebar() { $('#sidebar').classList.remove('open'); $('#sidebar-backdrop').classList.remove('open'); }
  $('#mobile-nav-toggle').addEventListener('click', openSidebar);
  $('#mobile-nav-close').addEventListener('click', closeSidebar);
  $('#sidebar-backdrop').addEventListener('click', closeSidebar);

  $('#add-season-btn').addEventListener('click', () => openSeasonModal(null));
  $('#add-season-btn-side').addEventListener('click', () => openSeasonModal(null));

  $('#season-modal-close').addEventListener('click', closeSeasonModal);
  $('#season-modal').addEventListener('click', e => { if (e.target.id === 'season-modal') closeSeasonModal(); });

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
    }
  });

  // Delegated clicks (actions across the whole app)
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const action = t.dataset.action;

    if (action === 'open-add-season') openSeasonModal(null);
    else if (action === 'close-season-modal') closeSeasonModal();
    else if (action === 'edit-season') {
      const s = state.seasons.find(s => s.id === t.dataset.id);
      if (s) openSeasonModal(s);
    } else if (action === 'delete-season') {
      const s = state.seasons.find(s => s.id === t.dataset.id);
      confirmDialog(`Delete ${s ? s.seasonLabel + ' at ' + s.club : 'this season'}? This cannot be undone.`, () => deleteSeason(t.dataset.id));
    } else if (action === 'add-row') {
      const kind = t.dataset.repeat;
      const factory = kind === 'competitions' ? emptyCompetition : kind === 'boardObjectives' ? emptyObjective : emptyTransfer;
      seasonDraft[kind].push(factory());
      reRenderRepeatSection(kind);
    } else if (action === 'remove-row') {
      const kind = t.dataset.repeat, idx = parseInt(t.dataset.index, 10);
      seasonDraft[kind].splice(idx, 1);
      reRenderRepeatSection(kind);
    } else if (action === 'jump-section') {
      const target = document.getElementById(t.dataset.target);
      if (target) {
        if (target.tagName === 'DETAILS') target.open = true;
        t.blur();
        requestAnimationFrame(() => {
          target.scrollIntoView({ behavior: 'auto', block: 'start' });
        });
      }
    } else if (action === 'jump-settings') {
      switchTab('settings');
    } else if (action === 'save-profile') {
      state.manager.name = $('#f-mgr-name').value.trim();
      state.manager.nationality = $('#f-mgr-nat').value.trim();
      state.manager.startingClub = $('#f-mgr-club').value.trim();
      state.manager.careerStartYear = $('#f-mgr-year').value.trim();
      saveState();
      toast('Profile saved');
      updateHeaderSubtitle();
    } else if (action === 'export-json') {
      exportJSON();
    } else if (action === 'reset-all') {
      confirmDialog('Reset ALL career data? Your manager profile and every season will be permanently deleted.', () => {
        state = defaultState();
        saveState();
        applyTheme();
        toast('All data reset', 'danger');
        switchTab('dashboard');
      });
    }
  });

  // Delegated input changes inside repeat rows (season form)
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.matches('[data-repeat][data-field]')) {
      const kind = t.dataset.repeat, idx = parseInt(t.dataset.index, 10), field = t.dataset.field;
      if (!seasonDraft || !seasonDraft[kind] || !seasonDraft[kind][idx]) return;
      seasonDraft[kind][idx][field] = t.type === 'checkbox' ? t.checked : t.value;
    }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.matches('[data-repeat][data-field][type="checkbox"]')) {
      const kind = t.dataset.repeat, idx = parseInt(t.dataset.index, 10), field = t.dataset.field;
      if (!seasonDraft || !seasonDraft[kind] || !seasonDraft[kind][idx]) return;
      seasonDraft[kind][idx][field] = t.checked;
    }
    if (t.id === 'theme-toggle' || t.closest?.('#theme-toggle')) return;
  });

  $('#season-form-body').addEventListener('submit', e => {
    if (e.target.id === 'season-form') { e.preventDefault(); saveSeasonDraft(); }
  });

  // Quicknav scroll-spy inside the season modal
  let spyPending = false;
  $('#season-modal').addEventListener('scroll', () => {
    if (spyPending) return;
    spyPending = true;
    requestAnimationFrame(() => {
      spyPending = false;
      let currentId = null;
      SEASON_SECTIONS.forEach(s => {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top - 150 <= 0) currentId = s.id;
      });
      $$('.quicknav-pill').forEach(p => p.classList.toggle('active', p.dataset.target === currentId));
    });
  });

  // Seasons tab controls
  $('#season-search').addEventListener('input', renderSeasons);
  $('#season-sort').addEventListener('change', renderSeasons);

  // Settings tab (delegated because content is re-rendered)
  $('#view-settings').addEventListener('click', e => {
    const btn = e.target.closest('#theme-toggle button');
    if (btn) {
      state.settings.theme = btn.dataset.theme;
      saveState();
      applyTheme();
      renderSettings();
    }
  });
  $('#view-settings').addEventListener('change', e => {
    if (e.target.id === 'f-currency') {
      state.settings.currency = e.target.value;
      saveState();
      toast('Currency updated');
    }
    if (e.target.id === 'import-file-input' && e.target.files[0]) {
      importJSON(e.target.files[0]);
      e.target.value = '';
    }
  });
}

/* ---------------- Init ---------------- */

function init() {
  applyTheme();
  wireEvents();
  switchTab('dashboard');
}

document.addEventListener('DOMContentLoaded', init);
