# Book Creator navigation matrix

The Book Creator used to keep all four steps in component state. Nothing was in
the URL and nothing was on disk, so a single back-press — a reflex on a phone —
left the wizard entirely and discarded every field the writer had filled in,
silently and with no way back.

Two rules fix it:

1. **The step lives in the URL** (`#/book-creator?step=cast`), so back means
   "the step before this one" to the browser's back button, Android's hardware
   back and iOS's swipe-back alike. None of those can be intercepted, so the
   only reliable answer is to give them something correct to do.
2. **The draft lives in `localStorage`** (`inkwell-book-draft`), so leaving by
   *any* route — back, Cancel, a crash, a phone reclaiming a background tab —
   loses nothing.

`localStorage` rather than the database on purpose: a half-formed idea is not a
book yet. It should not sync to other devices, appear in backups, or survive as
clutter; it is one device's scratchpad, replaced by real records the moment
**Create book** is pressed.

## The rules, stated once

| Gesture | What it does |
|---|---|
| Browser / hardware back, swipe-back | Undoes the last move. From step 1, leaves the wizard. |
| In-app **Back** | Goes to the previous step. Disabled on step 1. |
| Stepper | Jumps to any step already reached. Never further. |
| **Cancel** | Leaves. Asks first if anything has been typed. |
| Reload, tab kill, returning later | Puts the writer back on the step they left, fields intact. |
| Hand-typed `?step=` | Clamped to the furthest step actually reached. |

Every step change pushes one history entry, including the in-app **Back**
button. That is deliberate: back always undoes the writer's last move, which is
how the web works everywhere else, and it means the in-app control and the
hardware one can never disagree about where "back" goes.

## The matrix, as executed

Run in Chromium at iPhone 12 metrics (390×844, touch, mobile UA) against a
production build served over HTTP. Hardware back and iOS swipe-back are not
separately faked: both dispatch the same `popstate` as `page.goBack()`, so a
separate simulation would be testing the simulation.

Harness: `scripts/wizard-nav-matrix.mjs` (32 checks). Result at time of
writing: **32 passed, 0 failed**.

### A · forward through every step, then back out

| From | Gesture | Expected | Result |
|---|---|---|---|
| Projects | tap Book Creator | Concept | pass |
| Concept | Next ×3 | Review, `?step=review` | pass |
| Review | browser back | Cast, "Mira" still there | pass |
| Cast | browser back | Outline, chapter title still there | pass |
| Outline | browser back | Concept, title still there | pass |
| Concept | browser back | Projects | pass |
| Projects | browser forward | Review — re-entering restores the draft | pass |
| Review | browser forward | Outline | pass |

The forward-from-Projects row is the "come back later" path in disguise:
re-entering the wizard remounts it, the draft is read, and the writer lands
where they left off rather than on a blank step 1.

### B · the in-app controls

| From | Gesture | Expected | Result |
|---|---|---|---|
| Review | in-app Back | Cast | pass |
| Cast | in-app Back | Outline | pass |
| Outline | in-app Back | Concept | pass |
| Concept | — | Back is disabled | pass |
| Concept | stepper → Review | Review (already reached) | pass |
| Review | Cancel with a draft | confirmation appears | pass |
| Review | — | the confirmation fits the screen | pass (y=190, h=284, viewport 664) |
| confirm | Keep writing | Review, unchanged | pass |
| confirm | Leave | Projects, draft kept | pass |

### C · the draft outlives the tab

| From | Gesture | Expected | Result |
|---|---|---|---|
| Review | reload | Review, restored | pass |
| Review | — | "Picked up where you left off" shown | pass |
| Review | in-app Back after a reload | Cast — never escapes the app | pass |
| Cast | — | cast intact | pass |
| Cast | close the tab, reopen the wizard | Cast, restored | pass |
| Cast | stepper → Concept | title restored | pass |

The Back-after-reload row guards a specific trap: on a fresh document there is
no in-app history behind the wizard, so a Back that delegated to
`history.back()` would throw the writer out of the app entirely. It pushes the
previous step instead.

### D · a URL is a claim, not an achievement

| From | Gesture | Expected | Result |
|---|---|---|---|
| nothing | type `?step=review` | Concept — clamped | pass |
| Concept | type a title, reload | title restored | pass |
| Concept | Start fresh | empty | pass |
| Concept | reload | still empty | pass |
| Concept | — | no resume notice | pass |

## Proving the harness can fail

A green suite means nothing until it has been shown to go red for the right
reason. Reverting only `book-creator-wizard.tsx` to its previous version and
rebuilding gives:

```
PASS · enter from Projects (from projects) → concept
PASS · Next ×3 (from concept) → review · url=concept(no param)
FAIL · browser back (from review) → none — expected cast
```

The URL never changed, and one back-press left the wizard. That is the P0,
reproduced on demand.

## Re-running it

```bash
cd inkwell
INKWELL_BASE_PATH=/ npm run build
(cd dist && python3 -m http.server 5410 --bind 127.0.0.1 &)
node scripts/wizard-nav-matrix.mjs   # exits non-zero on any failure
```

Playwright is a tool this script borrows, not a dependency of the app, so it
resolves at runtime: set `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` or `BASE_URL` if
the defaults do not match the machine.

Re-run after any change to the wizard, the stepper, the draft module, or the
dialog primitives — the last because the Cancel confirmation's reachability is
one of the rows.

## Known limits

- The debounced save has a 400 ms window. A `pagehide` listener flushes it, which
  covers tab close, backgrounding and iOS discarding a background tab; a hard
  process kill inside that window is not recoverable, and is not worth a
  synchronous write on every keystroke to chase.
- The draft is per-device by design. It does not sync and is not in backups.
- One draft at a time. Starting a second book while one is unfinished offers to
  resume the first; **Start fresh** discards it.
