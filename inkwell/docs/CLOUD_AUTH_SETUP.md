# Cloud accounts & sync: production setup

Sign-in and cross-device sync are fully built and working. What's *not*
done — and can't be, by me — is registering INKWELL with Google, Meta, and
Apple. Those are identity registrations tied to you or your organisation.
This document is the exact list of what to click, in order.

Until you do this, everything still runs locally against the Firebase
Emulator Suite (`npm run firebase:emulators`), which is how the whole
feature was built and tested. Nothing here is required for local
development.

---

## What this costs

| Item | Cost |
|---|---|
| Firebase project (Auth + Firestore, Spark plan) | **Free** |
| Google sign-in | **Free** |
| Facebook sign-in (Meta developer account) | **Free** |
| Sign in with Apple | **$99/year** — requires the Apple Developer Program |
| Email/password sign-in | **Free** |

Apple is the only hard cost. If you skip it, set

```
VITE_AUTH_PROVIDERS=google,facebook
```

and the Apple button disappears — no code change needed. Leaving a button
that can only ever fail with `auth/operation-not-allowed` is worse than not
offering it, because the writer reads it as the app being broken rather than
as a provider you never set up. The variable accepts any comma-separated
subset of `google`, `apple`, `facebook`; unset means all three (which is
what local emulator development wants, since the emulator stubs every
provider), and `none` leaves email/password only.

Firebase's free Spark plan limits worth knowing: 1 GiB stored, 50,000
document reads/day, 20,000 writes/day. For a single writer that is a lot of
headroom — sync batches edits on an 800 ms debounce rather than writing per
keystroke — but a heavy multi-device day could approach the write cap. The
Blaze plan is pay-as-you-go beyond that.

---

## Step 1 — Create the Firebase project

1. Go to <https://console.firebase.google.com> and click **Add project**.
2. Name it (e.g. `inkwell`). Google Analytics is optional; INKWELL doesn't
   use it.
3. Wait for provisioning, then open the project.

## Step 2 — Create the Firestore database

1. **Build → Firestore Database → Create database**.
2. Pick a location close to you. **This is permanent** — it cannot be
   changed later without recreating the project.
3. Choose **Start in production mode** (locked down). The correct rules get
   deployed in the next step; starting in test mode would leave your data
   world-readable for 30 days.

## Step 3 — Deploy the security rules

The rules are already written (`firestore.rules`) and enforce that each
account can only ever read and write its own documents. They must actually
be deployed — the file sitting in the repo does nothing on its own.

1. Edit `.firebaserc` and replace `demo-inkwell` with your real project id.
2. From the `inkwell/` directory:

```bash
npx firebase login
npx firebase deploy --only firestore:rules
```

Verify in **Firestore → Rules** that the deployed rules match the file.

## Step 4 — Register the web app and get your config

1. **Project settings** (gear icon) **→ General → Your apps → Web** (`</>`).
2. Register the app with any nickname. Skip Firebase Hosting unless you
   want it.
3. Copy the `firebaseConfig` values into a new `inkwell/.env.local`
   (see `.env.example`):

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

`.env.local` is gitignored. These values are *not* secrets — a Firebase web
API key is a public project identifier, and your data is protected by the
security rules from Step 3, not by hiding this key. As soon as this file
exists the app talks to your real project instead of the emulator.

## Step 5 — Enable email/password

**Build → Authentication → Get started → Sign-in method → Email/Password →
Enable → Save.** Nothing else needed; this one works immediately.

## Step 6 — Enable Google

**Sign-in method → Google → Enable**, choose a project support email, and
save. Firebase creates the underlying OAuth client for you, so there is no
separate Google Cloud console trip for web sign-in.

## Step 7 — Enable Facebook

1. Go to <https://developers.facebook.com> → **My Apps → Create App**.
   Choose a type without a specific use case (**Other → Consumer** works).
2. Add the **Facebook Login** product to the app.
3. From **App settings → Basic**, copy the **App ID** and **App Secret**.
4. In Firebase: **Sign-in method → Facebook → Enable**, paste both, and
   **copy the OAuth redirect URI Firebase displays** — it looks like
   `https://your-project.firebaseapp.com/__/auth/handler`.
5. Back in Meta: **Facebook Login → Settings → Valid OAuth Redirect URIs**,
   paste that URI, and save.
6. Switch the Meta app from Development to **Live** mode.

Note: while the Meta app is in Development mode only accounts you've added
as testers can sign in. Requesting the `email` permission for the general
public requires Meta's App Review, which is a separate submission process
on their side.

## Step 8 — Enable Sign in with Apple

Requires an active **Apple Developer Program** membership ($99/year).

1. At <https://developer.apple.com/account> → **Certificates, Identifiers &
   Profiles → Identifiers**, create an **App ID** if you don't have one,
   enabling the **Sign In with Apple** capability.
2. Create a second identifier, this time a **Services ID** (this is the one
   web sign-in uses), e.g. `com.inkwell.app.web`.
3. Configure that Services ID for Sign In with Apple:
   - **Domains**: `your-project.firebaseapp.com`
   - **Return URLs**: `https://your-project.firebaseapp.com/__/auth/handler`
4. Go to **Keys → +**, enable **Sign In with Apple**, and create the key.
   **Download the `.p8` file — Apple lets you download it exactly once.**
   Note the **Key ID**, and your **Team ID** (top-right of the account page).
5. In Firebase: **Sign-in method → Apple → Enable**, then fill in the
   Services ID, Apple Team ID, Key ID, and the contents of the `.p8` file.

## Step 9 — Authorize your domains

**Authentication → Settings → Authorized domains.** `localhost` is there by
default. Add whatever domain you deploy the web build to. Sign-in is
rejected from any origin not on this list.

If you deploy with the bundled GitHub Pages workflow, the domain to add is
**`<owner>.github.io`** — the bare host, with no `/repo/` path and no
`https://`. For this repository that is `ash6677-cyber.github.io`.

Skipping this is the single most likely reason a freshly deployed site can't
sign in. The app now names the problem instead of shrugging: the error reads
"This site's domain isn't on the Firebase authorised domains list."

---

## Popup or redirect: which flow runs, and when

Social sign-in has two shapes and INKWELL picks between them at runtime.

**In a browser tab** it uses `signInWithPopup`. The page stays put, the
provider opens in a child window, and the result is handed back to the
opener.

**In an installed app** — anything running in standalone display mode, which
includes every iOS Home Screen install — it goes straight to
`signInWithRedirect`. This is not a preference. A standalone iOS web app has
no child-window relationship to hand a result back through: `window.open`
passes the URL to Safari as a separate app, nothing ever posts back, and the
popup promise never settles. The spinner spins until the writer gives up.
Since INKWELL actively asks people to install it (a Home Screen app is
exempt from Safari's seven-day storage eviction, so installing is a
data-safety measure), that path has to work.

**A blocked popup also falls back to redirect.** `auth/popup-blocked` and
`auth/operation-not-supported-in-this-environment` both mean the window
never opened, which redirect doesn't need. Every other error is reported as
itself — a redirect would throw away the page's state and then fail in
exactly the same way.

### The one caveat worth knowing

The redirect flow round-trips through `<your-project>.firebaseapp.com` and
comes back. Browsers that block third-party storage — Safari with ITP,
Firefox with strict protection, Brave — can drop the state it left behind on
the way, and the return trip fails with `auth/missing-initial-state`. The
app explains that in plain language and points at email sign-in, but the
real fix is to serve Firebase's auth handler from your own origin:

- Set `VITE_FIREBASE_AUTH_DOMAIN` to a domain you control that also serves
  `/__/auth/*` (Firebase Hosting does this automatically for its own
  domains), **or**
- reverse-proxy `/__/auth/` from your host to
  `<your-project>.firebaseapp.com`.

Neither is possible on GitHub Pages, which serves static files only and
can't proxy. So on a `github.io` deployment, expect installed-app social
sign-in to work on Chrome and Android and to be unreliable on iOS Safari;
email/password sign-in works everywhere and is unaffected. Moving the web
build to Firebase Hosting (also free on the Spark plan) removes the caveat
entirely, since the auth domain and the app would then share an origin.

---

## Desktop app (Tauri): read this before shipping social sign-in

The desktop build loads from an internal origin (`tauri://localhost` on
Linux, `http://tauri.localhost` on Windows) rather than a real web domain.
That has a concrete consequence:

- **Email/password sign-in and full cloud sync work in the desktop app.**
  Both talk to Firebase over ordinary HTTPS requests, which the app's
  Content-Security-Policy already permits.
- **Google / Facebook / Apple sign-in will not work in the packaged desktop
  app as currently wired.** They open an OAuth popup that hands the result
  back to its opener, and the provider redirect lands on
  `your-project.firebaseapp.com`, which then needs to message back to a
  `tauri://` origin. That origin cannot be added to Firebase's authorized
  domains list, which only accepts real domains.

The standard fix is to run the OAuth handshake in the user's real browser
and hand the result back to the app via a deep link — either
`tauri-plugin-oauth` (spins up a temporary localhost listener and uses
`http://localhost:<port>` as the redirect URI, which *is* an allowed
domain) or a registered custom URL scheme. That is a self-contained piece
of work, and I'd rather flag it plainly than let you discover it after
shipping an installer with three buttons that fail.

If you want desktop social sign-in, say so and I'll wire up the
localhost-listener flow. If desktop users signing in by email is
acceptable, nothing needs to change: the three social buttons are already
hidden when `isTauriRuntime()` is true, so they never appear where they
can't work.

Note also that the CSP in `src-tauri/tauri.conf.json` currently allows the
Firebase API hosts and the local emulator. Production social sign-in would
additionally need `frame-src` entries for `https://*.firebaseapp.com` and
`https://accounts.google.com`.

---

## What syncs, and what deliberately doesn't

Fifteen record types sync: projects, series, chapters, scenes, snapshots,
Codex entries, character cards, card chats, personas, lorebooks, covers, AI
presets, image assets, goals, and session logs.

**AI provider API keys never leave the device.** The `aiProviders` table is
excluded from sync by design — those are live credentials, and copying them
into a database is a materially different promise than syncing manuscripts.
This is verified by an automated check that plants a canary key locally and
confirms it appears nowhere in Firestore.

Conflicts resolve last-write-wins on each record's `updatedAt`. Two devices
editing *different* scenes both keep their work; two devices editing the
*same* scene keep whichever save happened later.

---

## Verifying your setup

With `.env.local` in place:

```bash
npm run dev
```

Then in the app: **Settings → Account → Sign in**, create an account, and
check that **Cloud sync** reports "Up to date". Open the Firebase console's
**Firestore → Data** tab and you should see `users/{your-uid}/projects/...`
appear as you create projects.

If sync reports an error:
- *"denied by the server"* → rules weren't deployed (Step 3).
- *"needs a Firestore database to be created"* → Step 2 was skipped.
- *"Can't reach the sync server"* → network, or the config in `.env.local`
  doesn't match a real project.
