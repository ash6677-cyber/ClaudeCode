# Auto-update

INKWELL checks for updates automatically on launch (silently — nothing
appears if there's no update or the check fails, e.g. offline) and on demand
via **Help > Check for Updates…**. When an update is found, a native dialog
asks to install it; accepting downloads it, installs it, and relaunches the
app.

## How it's wired

- `src-tauri/tauri.conf.json` → `plugins.updater` points at
  `https://github.com/ash6677-cyber/ink/releases/latest/download/latest.json`.
  GitHub automatically points `.../releases/latest/...` at whichever tagged
  release isn't marked pre-release, so publishing a new
  `inkwell-vX.Y.Z` release makes it the update target with no extra config.
- `bundle.createUpdaterArtifacts: true` makes `tauri build` also emit a
  `.sig` file next to the installer and a `latest.json` manifest describing
  the new version, both of which the CI workflow
  (`.github/workflows/inkwell-windows-build.yml`) uploads alongside the
  installer whenever it's triggered by an `inkwell-v*` tag.
- `src/app/desktop-menu-bridge.tsx` calls `@tauri-apps/plugin-updater`'s
  `check()` / `downloadAndInstall()` and `@tauri-apps/plugin-process`'s
  `relaunch()` — the same plugins Tauri's own docs recommend for this flow.

## The signing key

Unlike Authenticode code signing (see `WINDOWS_SIGNING.md`), the updater's
signature doesn't need a purchased certificate — it's a local ed25519
keypair generated once with `tauri signer generate`, used only so the app
can verify an update actually came from whoever holds the private key before
installing it.

That keypair has already been generated for this project. The **public**
key is committed in `tauri.conf.json` (`plugins.updater.pubkey`) — safe to
have in the repo, it's only used to verify, not to sign. The **private**
key was generated in the build sandbox and handed to you directly in chat
rather than committed anywhere, since anyone holding it could sign an
update your users' installs would accept as legitimate.

**To finish setup**, add it as GitHub Actions secrets on this repo
(Settings > Secrets and variables > Actions):

- `TAURI_SIGNING_PRIVATE_KEY` — the private key value from chat.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — leave empty; the key was generated
  without a password (fine for a solo/small-team project, but you can
  regenerate one with a password via `tauri signer generate -p <password>`
  and update both the secret and this note if you want that extra layer).

Without these two secrets set, the CI build still produces a working
installer and `.sig`/`latest.json` files — they just won't verify, so
in-app update checks will silently fail rather than offer a broken update.

## Releasing a new version

1. Bump `version` in `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`,
   and `package.json` (all three — Tauri reads the app version from
   `tauri.conf.json`, Cargo needs its own, and `package.json` is the
   Node-side source of truth for the same number).
2. Commit, then tag: `git tag inkwell-v0.2.0 && git push origin inkwell-v0.2.0`.
3. The `inkwell-windows-build.yml` workflow builds, signs (if the secrets
   above are set), and attaches the installer + `latest.json` to a GitHub
   Release for that tag.
4. Installed copies of INKWELL pick it up on their next launch or manual
   check, once that release is marked "Latest" on GitHub (the default for
   a new non-prerelease release).
