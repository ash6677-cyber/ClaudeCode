# Inkwell

A local-first novel-writing studio: a distraction-free manuscript editor, a linked
worldbuilding Codex, SillyTavern-style character cards, a Cover Studio, and a guided
Book Creator wizard — built to feel calmer and more capable than the tools that inspired it.

This project is self-contained and lives in its own `inkwell/` directory; it does not
share dependencies or configuration with anything else in this repository.

## Stack

React 18 + TypeScript + Vite · Tailwind CSS v4 + shadcn-style components (Radix
primitives) · React Router · Zustand · Dexie.js (IndexedDB) · TipTap (from Phase 2).

## Getting started

```bash
cd inkwell
npm install
npm run dev
```

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and build for production
- `npm run typecheck` — type-check only
- `npm run lint` — run ESLint
- `npm run format` — format with Prettier
- `npm run preview` — preview the production build

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
- [ ] Phase 4 — AI engine
- [ ] Phase 5 — Scene Beats → prose
- [ ] Phase 6 — Character face cards
- [ ] Phase 7 — Character chat / lorebooks
- [ ] Phase 8 — Cover Studio
- [ ] Phase 9 — Book Creator wizard
- [ ] Phase 10 — Planning tools
- [ ] Phase 11 — Export
- [ ] Phase 12 — Stats & goals
- [ ] Phase 13 — Polish pass
