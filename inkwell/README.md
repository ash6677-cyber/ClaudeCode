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
