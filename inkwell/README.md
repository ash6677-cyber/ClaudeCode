# Inkwell

A local-first novel-writing studio: a distraction-free manuscript editor, a linked
worldbuilding Codex, SillyTavern-style character cards, a Cover Studio, and a guided
Book Creator wizard — built to feel calmer and more capable than the tools that inspired it.

This project is self-contained and lives in its own `inkwell/` directory; it does not
share dependencies or configuration with anything else in this repository.

## Stack

React 19 + TypeScript + Vite · Tailwind CSS v4 + shadcn-style components (Radix
primitives) · React Router · Zustand · Dexie.js (IndexedDB, browser build) · TipTap ·
Tauri 2 + Rust (Windows desktop shell, `src-tauri/`).

## Getting started

```bash
cd inkwell
npm install
npm run dev
```

## Web deployment (GitHub Pages)

`.github/workflows/deploy-pages.yml` builds `inkwell/` and publishes it to GitHub
Pages on every push to the default branch. **It only runs once it is on the default
branch** — GitHub does not dispatch workflows that exist only on a feature branch.

Before the first deploy, enable it once in the repository: **Settings → Pages →
Build and deployment → Source: GitHub Actions**. On a private repository, Pages
requires a paid GitHub plan.

The site lands at `https://<owner>.github.io/<repo>/`. A project site is served
from a subpath, so the build sets `INKWELL_BASE_PATH=/<repo>/` and Vite prefixes
every asset URL to match; the workflow fails the build if a stray `/assets/` URL
survives, since that would 404 and leave a blank page. No SPA rewrite rules are
needed — the app uses hash routing (`#/projects`) precisely so it works on static
hosting that can't rewrite paths.

To deploy anywhere else, build with the base path set to wherever it will be served
(`INKWELL_BASE_PATH=/ npm run build` for a domain root) and upload `dist/`.

### Cloud features on a deployed build

A build with no `VITE_FIREBASE_API_KEY` has no Firebase project behind it, so
accounts and cross-device sync are switched off and the Account tab says so. This is
deliberate: the dev fallback points Firebase at the local emulator on `127.0.0.1`,
which on a deployed site would mean *the visitor's own machine*. Everything else —
writing, the Codex, cards, covers, the reader, export, stats — is local-first and
works unchanged.

To switch them on, add these as repository **variables** (Settings → Secrets and
variables → Actions → *Variables* tab) and re-run the deploy:

```
VITE_FIREBASE_API_KEY              VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_AUTH_DOMAIN          VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_PROJECT_ID           VITE_FIREBASE_APP_ID
```

Variables rather than secrets, on purpose. Every `VITE_` value is compiled into the
public JavaScript bundle, so calling them secret would only disguise the fact that
anyone can read them. Firebase web config is *designed* to be public — access is
controlled by `firestore.rules`, not by hiding the API key. Storing them as secrets
would also make GitHub mask them in the build log, turning a typo into a mystery.

The workflow prints which mode it built in, and reminds you to add
`<owner>.github.io` to Firebase's authorised domains — skipping that is the most
common reason a freshly deployed site can't sign in.

Note that Sign in with Apple requires a paid Apple Developer Program membership.
Email/password, Google and Facebook do not; leave Apple disabled in the Firebase
console and that button reports it is unavailable rather than failing obscurely.

## Desktop app (Windows)

INKWELL ships as a native Windows desktop app via Tauri 2 (`src-tauri/`). The web
app above is the same codebase — the desktop shell just wraps it in a native window
with disk-backed storage instead of the browser build's IndexedDB.

```bash
cd inkwell
npm install
npm run desktop:dev     # hot-reloads the shell against the Vite dev server
npm run desktop:build   # produces the Windows NSIS installer (see src-tauri/target/release/bundle/nsis)
```

`desktop:dev` starts the Vite dev server and opens a native window pointed at it —
edit any file under `src/` and the window hot-reloads exactly like the browser dev
server does. Requires the Rust toolchain (`rustup`) and, on Linux/dev machines without
Windows, the Tauri Linux prerequisites (`webkit2gtk`, `gtk3`) to run the dev shell
locally.

`desktop:build` must run on an actual Windows machine (or the
[`inkwell-windows-build.yml`](../.github/workflows/inkwell-windows-build.yml)
GitHub Actions workflow, which builds on a `windows-latest` runner) — there's no
practical way to cross-compile Tauri's WebView2/Win32 bindings from Linux or
macOS. The resulting installer is unsigned by default; see
[`docs/WINDOWS_SIGNING.md`](docs/WINDOWS_SIGNING.md) for what a code signing
certificate buys you and how to wire one in once you have one.

INKWELL checks for updates on launch and via Help > Check for Updates…, and
can install them in place — see [`docs/AUTO_UPDATE.md`](docs/AUTO_UPDATE.md)
for how releases are published and the one-time secret setup it needs.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and build for production
- `npm run typecheck` — type-check only
- `npm run lint` — run ESLint
- `npm run format` — format with Prettier
- `npm run preview` — preview the production build
- `npm run desktop:dev` — run the Tauri desktop shell in dev mode (hot reload)
- `npm run desktop:build` — build the Windows installer

## Project structure

```
src/
  app/          # app shell, routing, providers, layout
  components/   # ui/ (design-system primitives) + common/ (shared app components)
  features/     # one folder per product area (projects, editor, codex, cards, ...)
  lib/          # db (Dexie schema + repositories), utils
  stores/       # Zustand stores, one per domain
  types/        # shared entity types
```

UI code talks to persistence only through the repository layer in `src/lib/db/` —
never directly to Dexie. See the build phases below for what's implemented so far.

## Build phases

Built incrementally, one fully-finished feature area at a time:

- [x] Phase 0 — Foundation (this shell)
- [x] Phase 1 — Projects & dashboard
- [x] Phase 2 — Manuscript editor core
- [x] Phase 3 — Codex
- [x] Phase 4 — AI engine
- [x] Phase 5 — Scene Beats → prose
- [x] Phase 6 — Character face cards
- [x] Phase 7 — Character chat / lorebooks
- [x] Phase 8 — Cover Studio
- [x] Phase 9 — Book Creator wizard
- [ ] Phase 10 — Planning tools
- [ ] Phase 11 — Export
- [ ] Phase 12 — Stats & goals
- [ ] Phase 13 — Polish pass
