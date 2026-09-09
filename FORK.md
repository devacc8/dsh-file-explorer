# FORK — dsh-file-explorer (vendored)

This directory is a **vendored, frozen fork** of a third-party DeepSeek Harness (DSH)
plugin. It is owned by this project and is **not** tracked against upstream anymore.

## Provenance

| Field | Value |
|---|---|
| Upstream | https://github.com/joejojoking-cloud/dsh-file-explorer |
| Upstream ref | `main` (shallow clone, single commit `4b3a609`, "docs: add release notes for v0.1.7") |
| Version | `0.1.7` |
| License | MIT |
| Vendored on | 2026 (see git log of this fork) |
| Status | **FROZEN — no upstream updates** |

Upstream `.git` was removed and a fresh local repository was initialized, so there is
no `origin` to pull from. Updating from upstream is intentionally not supported: any
future change is made here, by us.

## Why it exists

DSH's web GUI has no built-in file-tree panel. This plugin adds a right-side,
resizable file explorer (tree + preview + in-panel editor) scoped to the current
session workspace, plus a header toggle button.

## Runtime surface

Only two files execute:

| File | Role |
|---|---|
| `lib/index.js` | Host half. Registers `/plugins/file-explorer/*` HTTP routes on the DSH web server. Runs in the DSH host process. |
| `lib/client.js` | Browser half. Served to the GUI; renders the panel (`shell.overlay`) and the header toggle (`conversation.session.header.actions`). |

`lib/client/index.js` is an intermediate `tsc` artifact (not served). Source of truth
is `src/index.ts` (host) and `src/client/index.ts` (browser); `lib/` is the committed
build.

## Our patches (on top of upstream 0.1.7)

1. **English localization.** All UI strings translated from Chinese: 33 client
   strings and 6 host error strings. Applied to `lib/client.js`, `lib/index.js`,
   `src/client/index.ts`, `src/index.ts`. No Chinese text remains in any of the four.
2. **Edit (pencil) button UX fix.** The button silently did nothing when no file was
   editable. It is now greyed out with the tooltip "Select a file in the tree to
   edit" and reports that same message instead of failing silently.
3. **Markdown link hardening.** Rendered markdown links now reject dangerous schemes
   (`javascript:`, `data:`, `vbscript:`, `blob:`, `file:`) after control-character
   normalization; such links render as plain text. Relative and http(s)/mailto links
   are unaffected.

`src/` and `lib/` carry the same patches, so a rebuild from `src/` reproduces the
running artifact (see "Build" below).

## Security audit

See `AUDIT.md` for the full audit (capabilities, network sinks, process execution,
findings, verdict).

## Install / remove

Installed into the `web` profile and linked from here:

```sh
dsh plugin --profile web add /home/hromium/projects/voices/refs/dsh-file-explorer
# restart dsh web afterwards
dsh plugin --profile web remove dsh-file-explorer
```

The plugin is linked (`link:`) into `$DSH_HOME/profiles/web`, so this directory must
stay in place while it is installed.

## Build

```sh
pnpm install && pnpm run build   # clean && tsc && tsc -p tsconfig.client.json && tsdown
```

Known caveat: a standalone `pnpm install` can fail resolving the declared
`@deepseek-ai/dsh-client-*` peer dependencies, because their transitive
`@deepseek-ai/dsh-compact` is not published to npm (404). The committed `lib/` is the
build that is actually installed; hand patches were applied to `lib/` and mirrored
into `src/`.

## Tests

```sh
node --test
```

Expected on Linux: 8 pass, 1 fail, 3 skipped. The single failure
("reports 500 when launching throws") is pre-existing and platform-specific: it
assumes the Windows `explorer` branch, while on Linux the route resolves
`xdg-open`, never spawns, and returns 200. Verified identical against the
unmodified upstream `lib/index.js`.
