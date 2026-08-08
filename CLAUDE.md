# CLAUDE.md

Guidance for AI assistants (and humans) working in this repository.

## What this repository is

This repo (`ash6677-cyber/ink`) hosts **two independent applications** that share
one Git repository and one GitHub Pages site but nothing else — no shared
dependencies, build step, or configuration:

1. **INKWELL** (`inkwell/`) — the primary, actively-developed project. A
   local-first novel-writing studio: manuscript editor, worldbuilding Codex,
   character cards, Cover Studio, Book Creator wizard, and more. React 19 +
   TypeScript + Vite, packaged for the web and as a Tauri 2 Windows desktop app.

2. **FC Career Tracker** (repository root) — an older, self-contained
   football career-mode stats tracker. A zero-build-step vanilla-JS PWA wrapped
   as an Electron desktop app, persisting to `localStorage`.

> ⚠️ **Almost all new work is in `inkwell/`.** Treat the root FC Career Tracker
> as a separate, stable legacy app. Do not mix concerns between the two.

The two apps are only entangled at deploy time (one repo → one Pages site) and
via the root service worker's scope — see [Deployment](#deployment).

---

## INKWELL (`inkwell/`)

The main project. All commands below run **from the `inkwell/` directory**.

### Stack

- **React 19 + TypeScript (~6.0) + Vite 8** — SPA with **hash routing**
  (`#/projects`) so it works on static hosting with no rewrite rules.
- **Tailwind CSS v4** (`@tailwindcss/vite`) + shadcn-style components built on
  **Radix UI** primitives (`src/components/ui/`).
- **Zustand** — state management, one store per domain (`src/stores/`).
- **Dexie.js** (IndexedDB) — browser persistence, behind a repository layer.
- **TipTap 3** (ProseMirror) — the manuscript editor.
- **Firebase** — optional cloud auth + Firestore sync (off by default).
- **three.js** — 3D box-set / series visualization (lazy-loaded).
- **Tauri 2 + Rust** (`src-tauri/`) — native Windows desktop shell.
- **Vitest** — unit tests. **`@` aliases `src/`** (see `vite.config.ts`).

### Common commands

```bash
cd inkwell
npm install
npm run dev          # Vite dev server
npm run build        # tsc -b && vite build (production)
npm run typecheck    # tsc -b --noEmit
npm run lint         # ESLint
npm run format       # Prettier
npm test             # vitest run
npm run preview      # preview the production build
npm run desktop:dev  # Tauri desktop shell, hot-reloading against Vite
npm run desktop:build # Windows NSIS installer (must run on Windows)
```

**Before considering a change done, run the same gates CI runs** (see
`.github/workflows/pr-checks.yml`), in this order, from `inkwell/`:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

The build step matters: it is run with `INKWELL_BASE_PATH=/<repo>/` in CI so a
broken asset prefix fails there rather than on the live site.

### Directory layout (`inkwell/src/`)

```
app/          # app shell, router, providers, layout, command palette, global shortcuts
components/
  ui/         # design-system primitives (shadcn-style, Radix-backed) — button, dialog, ...
  common/     # shared app-level components (page-header, empty-state, confirm dialogs, ...)
features/     # ONE folder per product area — the bulk of the code
lib/          # cross-cutting infrastructure (see below)
stores/       # Zustand stores, one per domain
types/        # shared entity types (barrel-exported via types/index.ts)
```

Each **feature** folder (`features/<area>/`) is self-contained and typically has:

- `routes/` — page-level route components
- `components/` — feature-specific UI
- `lib/` — feature-specific logic (often with colocated `*.test.ts`)

Product areas present: `projects`, `editor`, `codex`, `cards`, `covers`,
`book-creator`, `series`, `reader`, `export`, `planning`, `stats`, `settings`,
`templates`, `theme`, `almanac`, `auth`.

### `lib/` infrastructure

- **`lib/db/`** — persistence. This is the most important architectural
  boundary in the app.
- **`lib/ai/`** — AI engine: prompt builders, SSE streaming, token estimation,
  and pluggable provider adapters (`providers/`: `anthropic`,
  `openai-compatible` — the latter also serves `openai` and `openrouter`).
- **`lib/sync/`** — Firestore sync engine, entity codec, synced-table wrapper.
- **`lib/firebase/`** — Firebase initialization (no-op when unconfigured).
- **`lib/editor/`**, **`lib/hooks/`**, **`lib/storage/`** (durability),
  plus utilities: `utils.ts`, `format.ts`, `base64.ts`, `shortcuts.ts`,
  `viewport.ts`, `image-upload.ts`.

### Persistence — the key convention

**UI code and stores talk to persistence ONLY through the repository layer in
`src/lib/db/`. Never touch Dexie (or the desktop store) directly from features.**

- `lib/db/repository.ts` — `createRepository<T>(table)` returns a typed CRUD
  wrapper (`list`, `get`, `create`, `update`, `remove`, `bulkRemove`). It stamps
  `id` (`crypto.randomUUID()`), `createdAt`, and `updatedAt` automatically.
- `lib/db/repositories.ts` — the concrete repo instances (`projectRepo`,
  `sceneRepo`, `codexRepo`, …). Import these.
- `lib/db/schema.ts` — the Dexie schema (`InkwellDB`) and the `db` singleton.
- The repository works structurally against either a real Dexie `EntityTable`
  **or** the in-memory / disk-backed table used by the Tauri desktop shell
  (`TableLike<T>`), so the same feature code runs on both backends.

**All entities extend `BaseEntity`** (`types/base.ts`): `id`, `createdAt`,
`updatedAt`, plus soft-delete fields `deletedAt` and `deletedWith`. Deletion is
**soft** (records go to a bin) and **cascading** (`lib/db/cascade.ts` — deleting
a chapter bins its scenes; `deletedWith` records what swept a record up so the
bin can restore them as a unit). See `soft-delete.ts` and the colocated tests.

### Cloud features (Firebase)

Off unless configured. A build with no `VITE_FIREBASE_API_KEY` has no backend —
accounts and cross-device sync are disabled and the Account tab says so. The
whole app (writing, Codex, cards, covers, reader, export, stats) is
**local-first** and works fully with cloud switched off. Local dev config lives
in `inkwell/.env.example`; `npm run firebase:emulators` starts the local
auth + Firestore emulators. Firebase web config values are **public by design**
(access is enforced by `firestore.rules`), so in CI/deploy they are stored as
repository **variables**, not secrets.

### Coding conventions

- **TypeScript strict**, ES modules (`"type": "module"`), 2023 target.
- **Prettier** (`.prettierrc.json`) — no semicolons, single quotes, etc. Run
  `npm run format`; don't hand-fight the formatter.
- **ESLint** (`eslint.config.js`, flat config) — `js.recommended` +
  `typescript-eslint` + `react-hooks` + `react-refresh` + prettier-off. Unused
  vars prefixed `_` are ignored.
- Import from `src` via the **`@/` alias** (e.g. `@/lib/db/repositories`).
- Types are barrel-exported from `@/types` (`types/index.ts`).
- **Tests are colocated** as `*.test.ts` next to the code (Vitest). Add or
  update tests when you touch logic that has them.
- Zustand stores follow the pattern in `stores/project-store.ts`: a typed state
  interface with `LoadStatus` (`idle`/`loading`/`ready`/`error`) and async
  actions that go through repositories.

### Further docs

`inkwell/README.md` (deep detail on deploy/desktop) and `inkwell/docs/`:
`AUTO_UPDATE.md`, `WINDOWS_SIGNING.md`, `CLOUD_AUTH_SETUP.md`,
`FEATURE_VERIFICATION.md`.

---

## FC Career Tracker (repository root) — legacy

A self-contained football career-mode stats tracker. Single-file vanilla JS, no
build step, persists to `localStorage`, installable as a PWA, and shipped as an
Electron desktop app.

### Key files

- `index.html` — the entire UI markup.
- `assets/app.js` — all application logic (~4400 lines, single file, no build).
- `assets/style.css`, `assets/trophy3d.js` (three.js trophy cabinet),
  `assets/vendor/` (bundled three.js + Tesseract.js OCR).
- `sw.js` — service worker (offline PWA cache). **Guards `/inkwell/` paths** so
  it never intercepts INKWELL's requests (see Deployment).
- `electron/main.js`, `electron/preload.js` — Electron shell.
- `manifest.webmanifest`, `404.html`.

### Commands (from the repository root)

```bash
npm install
npm start              # run the Electron app
npm test               # Playwright end-to-end tests
npm run test:headed    # Playwright, headed
npm run dist:win       # build Windows installer (electron-builder)
npm run dist:linux     # build Linux AppImage
```

### Testing

Playwright specs in `tests/*.spec.js` (with `tests/fixtures/` images for OCR).
`playwright.config.js` serves the static site via `python3 -m http.server 8877`.
Set `PLAYWRIGHT_CHROMIUM_PATH` to use a system Chromium instead of
`playwright install`. No type-checking or linting here — it's plain JS.

---

## Deployment

**One repository → one GitHub Pages site**, assembled by
`.github/workflows/deploy-pages.yml` on push to the default branch. Because a
repo gets only one Pages site, the workflow builds **both** apps:

- **INKWELL owns the root**: `https://<owner>.github.io/<repo>/`
- **FC Career Tracker lives at**: `https://<owner>.github.io/<repo>/tracker/`

> Note: `inkwell/README.md` describes an earlier layout where the tracker kept
> the root and INKWELL sat at `/inkwell/`. The **workflow is the source of
> truth** — INKWELL now owns the root and the tracker is published under
> `/tracker/`. If you touch deployment, reconcile the README to match.

Deployment mechanics to respect:

- INKWELL is built with `INKWELL_BASE_PATH=/<repo>/` so Vite prefixes every
  asset URL. The workflow **fails the build if a stray `/assets/` URL survives**
  (it would 404 to a blank page). Renaming the repo changes this base path.
- INKWELL uses **hash routing** on purpose — static hosting can't rewrite paths.
- The tracker's **service worker** registers at the repo root, so its scope
  covers INKWELL's requests too. `sw.js` skips any path containing `/inkwell/`.
  Removing that guard would cache and stale-serve INKWELL, pinning it a deploy
  behind. (Keep this guard even though the tracker moved to `/tracker/`.)

### CI workflows (`.github/workflows/`)

- **`pr-checks.yml`** — on PRs touching `inkwell/**`: typecheck, lint, test,
  build (the gates you should run locally before pushing).
- **`deploy-pages.yml`** — build + assemble + publish both apps to Pages.
- **`inkwell-windows-build.yml`** — build the INKWELL Tauri Windows installer
  on a `windows-latest` runner (Tauri can't cross-compile from Linux/macOS).
- **`build-windows.yml`** — FC Career Tracker Windows build.

---

## Working in this repo (for AI assistants)

- **Know which app you're in.** `inkwell/` is React/TS with a build; the root is
  vanilla-JS PWA. They share nothing — don't import or cross-reference.
- **For INKWELL changes**, always run `typecheck → lint → test → build` from
  `inkwell/` before declaring done, and add/update colocated `*.test.ts`.
- **Respect the repository boundary** in INKWELL: persistence goes through
  `lib/db` repositories, never raw Dexie.
- **Match surrounding style** — Prettier settings, no-semicolon TS, `@/` imports.
- **Don't break deployment invariants** (base path, hash routing, the `sw.js`
  `/inkwell/` guard).

### Git workflow

- Develop on the designated feature branch; commit with clear messages; push
  with `git push -u origin <branch>`.
- **Do not open a pull request unless explicitly asked.**
