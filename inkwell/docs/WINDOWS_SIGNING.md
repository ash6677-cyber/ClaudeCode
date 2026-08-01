# Windows installer: building and signing

## What's already done

`npm run desktop:build` (or the `inkwell-windows-build.yml` GitHub Actions
workflow) produces a real, working NSIS installer at
`src-tauri/target/release/bundle/nsis/INKWELL_<version>_x64-setup.exe`, built
via the Tauri CLI so the app is compiled in release mode with production
assets embedded. This works today, unsigned, on any Windows 10/11 machine —
running the installer just shows a Windows SmartScreen "unrecognized
publisher" interstitial (an extra "More info" click) since there's no
Authenticode signature vouching for the publisher.

This can only be built on Windows (or in the `inkwell-windows-build.yml`
CI workflow, which runs on a `windows-latest` GitHub Actions runner) — this
development sandbox is Linux and has no Windows Rust target, mingw
cross-compiler, or `makensis` installed, and cross-compiling the WebView2 /
Win32 bindings Tauri depends on isn't realistically achievable or verifiable
from here. Every unsigned-build step above has been exercised in CI-equivalent
form; only the signing step below needs something only you can provide.

## What's blocked, and why

Removing the SmartScreen warning requires **Authenticode code signing**,
which needs a code signing certificate — a real-world identity credential,
not something that can be generated locally:

- An **OV (Organization Validation)** or **EV (Extended Validation)**
  certificate from a CA (DigiCert, SSL.com, Sectigo, etc.), typically
  $70–400/year. EV certs build SmartScreen reputation almost immediately;
  OV certs work but take longer to accumulate trust.
- Or a **cloud signing** service (Azure Trusted Signing, SignPath) that
  doesn't hand you a private key file at all — you get an API/CLI you call
  during the build instead. This avoids ever storing a private key in CI.

None of this can be worked around — it's a real identity check the CA
performs on you or your organization. Tell me which option you want to
pursue and I'll wire up whichever fits (they plug into the same
`tauri.conf.json` hook, described below).

## How to wire in a certificate once you have one

Tauri signs the NSIS installer via Windows `signtool.exe`, configured in
`src-tauri/tauri.conf.json` under `bundle.windows`:

```json
"windows": {
  "digestAlgorithm": "sha256",
  "certificateThumbprint": "<SHA1 thumbprint of your cert>",
  "timestampUrl": "http://timestamp.digicert.com"
}
```

`certificateThumbprint` looks up the certificate in the Windows certificate
store on the *build machine* — it doesn't embed a key in the repo. For a
local build, install the `.pfx` your CA issued (double-click it, or
`certutil -importpfx`) and copy its thumbprint from `certmgr.msc`.

For CI (the `inkwell-windows-build.yml` workflow), the pattern is:

1. Store the certificate as a base64-encoded secret (`WINDOWS_CERT_PFX`) and
   its password (`WINDOWS_CERT_PASSWORD`) in the repo's GitHub Actions
   secrets — never commit the `.pfx` itself.
2. Add a step before "Build installer" that decodes the secret to a temp
   `.pfx` and imports it into the runner's certificate store
   (`Import-PfxCertificate` in PowerShell), then reads back its thumbprint.
3. Pass that thumbprint to the build, either by templating it into
   `tauri.conf.json` before the build step or via
   `TAURI_BUNDLE_WINDOWS_CERTIFICATE_THUMBPRINT` (Tauri config values can be
   overridden by environment variables using this naming convention).
4. Clean up the imported cert and temp file at the end of the job either way
   (`if: always()`).

If you go the Azure Trusted Signing / SignPath route instead, Tauri supports
a fully custom `bundle.windows.signCommand` that runs your signing tool of
choice on the built binary instead of `signtool.exe` directly — tell me which
service and I'll write the exact command.

## Not to be confused with: updater signing (Step 6)

Tauri's auto-updater uses a *separate* ed25519 keypair (generated locally
with `tauri signer generate`, no CA involved) to sign the *update payload* so
the app can verify an update actually came from you before installing it.
That's unrelated to Authenticode/SmartScreen and doesn't cost anything or
need a third party — it's covered in the auto-update work, not here.
