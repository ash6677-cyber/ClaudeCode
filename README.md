# INKWELL

A place to write a novel. Manuscript editor, worldbuilding wiki, planning
board, cover designer, and characters you can actually talk to — all of it
kept on your own machine.

## Get it

**[Download for Windows →](https://github.com/ash6677-cyber/ink/releases/latest)**

Run the `.exe`. Windows will warn about an unrecognised app the first time —
the installer is not certificate-signed yet, so choose **More info**, then
**Run anyway**. Your books are saved as ordinary files on your computer, it
works with no internet at all, and it updates itself.

**[Or use it in a browser →](https://ash6677-cyber.github.io/ink/)**

Everything works there too, with one difference worth knowing: a browser is
allowed to clear its own storage. Use **Settings → Data → Back up everything**
if you are working that way.

## Bringing your own AI

Nothing here calls an AI service unless you connect one, and when you do, it
is your key and your account. Paste a key into **Settings → AI**, or from the
button inside any character chat — the app recognises which service the key
belongs to and fills in the rest. OpenRouter, Anthropic, OpenAI, or anything
speaking the OpenAI format, including a model running on your own machine.

Keys are stored on this device only. They are never sent anywhere but the
service they belong to, and they are deliberately left out of backups and
cloud sync.

## Working on it

The app lives in [`inkwell/`](inkwell/). From there:

```
npm install
npm run dev            # the web app
npm run desktop:dev    # the Windows app
npm run typecheck && npm run lint && npm test
```

`scripts/` holds acceptance harnesses that drive the built app in a real
browser against a real database — they catch the things unit tests cannot.
Build first (`INKWELL_BASE_PATH=/ npm run build`), serve `dist/`, then run
one.

Longer notes live in [`inkwell/docs/`](inkwell/docs/), and the running list of
what is planned and why is in [`IMPROVEMENT-PLAN.md`](IMPROVEMENT-PLAN.md).
