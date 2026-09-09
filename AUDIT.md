# AUDIT — dsh-file-explorer (vendored fork, 0.1.7)

Security audit performed before adopting this plugin as our own and freezing it.
See `FORK.md` for provenance and the patch list.

## Verdict

**CLEAN.** No malware, no covert behaviour, no data exfiltration, no arbitrary
command execution. The plugin's only privileged capabilities are (a) sandboxed
workspace file I/O and (b) launching two fixed local programs on user action.

## Scope

| Kind | Files |
|---|---|
| Executes in the DSH host | `lib/index.js` (15.8 kB) |
| Served to the browser | `lib/client.js` (70.0 kB) |
| Sources | `src/index.ts`, `src/client/index.ts` |
| Build / deps / tests / composition | `package.json`, `tsdown.config.ts`, `tsconfig*.json`, `test/open-folder.test.mjs`, `cordis.patch.yml` |

Dead build intermediates (`lib/client/index.js` + `.map` + `.d.ts`) were removed;
they were not reachable at runtime.

## Method

1. Full read of the host source and the built host artifact.
2. Full read of the client source and the built browser bundle.
3. Pattern scan across every `.ts`/`.js`/`.mjs`/`.json`/`.yml` file for:
   process execution, network sinks, raw filesystem access, secret/env access,
   dynamic code evaluation, and obfuscation primitives.
4. Entropy scan for long high-entropy (base64/hex-like) literals — none found.
5. Non-ASCII enumeration — only source comments and typographic characters remain.
6. Provenance: compared capabilities of `lib/index.js` against `src/index.ts`
   (routes, spawned programs, service usage) — identical.
7. Live verification against the running DSH server (host route returns a real
   workspace listing; the served bundle is the patched one).
8. Ran the repository's own test suite, and re-ran it against the unmodified
   upstream artifact to separate pre-existing failures.
9. Independent adversarial review of each half by a separate agent (see below).

## Capability inventory

### Host — `lib/index.js`

HTTP routes registered on the DSH web server (all exact-match, all under
`/plugins/file-explorer/`):

| Route | Operation |
|---|---|
| `GET list` | list a directory via `ctx.fs` |
| `GET search` | recursive name search, capped (4000 nodes / 300 matches), skips `.git` and `node_modules` |
| `GET read` | read a text file, capped at 1 MB |
| `POST write` | write a text file via `ctx.fs` |
| `POST open-vscode` | launch VS Code (`code`) with the given path |
| `POST open-folder` | launch the system file manager (`explorer` / `open` / `xdg-open`) |

- Filesystem access goes exclusively through the DSH `ctx.fs` service
  (`resolve`, `stat`, `listDir`, `readText`, `writeText`, `processPath`), i.e. the
  host sandbox — **not** raw `node:fs`.
- Process launching goes through the DSH `subprocess`/`shell` seams with **argv
  arrays**; on Linux no shell string is interpolated.
- `process.env`: **none**. `child_process`: **none**. Network sinks: **none**.
- Secrets (`~/.ssh`, credentials, tokens, API keys): **none**.

### Browser — `lib/client.js`

Network sinks — exactly six, all relative to the page origin:

```
/plugins/file-explorer/list?path=
/plugins/file-explorer/search?root=
/plugins/file-explorer/read?path=
/plugins/file-explorer/write
/plugins/file-explorer/open-vscode
/plugins/file-explorer/open-folder
```

- Registered slots: `shell.overlay` (panel) and
  `conversation.session.header.actions` (toggle). One `document` `dblclick`
  listener, scoped to the chat column and disposed on teardown.
- External URLs: **none**. `eval` / `new Function` / dynamic `import` /
  `document.write` / `script` injection: **none**.
- `sendBeacon`, `WebSocket`, cookies, `localStorage`: **none**.
- Obfuscation: **none** (no base64/atob/btoa, no high-entropy blobs).
- HTML injection: `escapeHtml` covers every markdown insertion point; the syntax
  highlighter escapes all text before wrapping tokens.

## Findings

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | medium | Markdown links accepted any URL scheme, so a crafted `.md` file could render a `javascript:`/`data:` link (click-to-XSS in the GUI origin). | **Fixed** — dangerous schemes (`javascript:`, `data:`, `vbscript:`, `blob:`, `file:`) are rejected after control-character normalization and render as plain text. |
| 2 | low | The Edit (pencil) button silently did nothing when no file was editable. | **Fixed** — greyed state, explanatory tooltip, and a status message. |
| 3 | low | `open-vscode` / `open-folder` launch local programs. | **Accepted** — bounded to fixed binaries, argv arrays, no shell interpolation on Linux. Can be stripped if the feature is not wanted. |
| 4 | info | Plugin routes carry no custom auth header; they rely on the DSH trust fence and same-origin fetch. | **Accepted** — consistent with how DSH mounts plugin routes. |
| 5 | info | All UI text was Chinese. | **Fixed** — fully English (33 client + 6 host strings). |
| 6 | info | One test fails on Linux ("reports 500 when launching throws"). | **Accepted** — pre-existing and platform-specific; reproduced identically against the unmodified upstream artifact. |

## Explicit non-capabilities

The plugin cannot:

- send data anywhere off the origin (no network code exists in either half);
- execute arbitrary commands (no shell, no `child_process`, no interpolated argv);
- read or write outside the session workspace (all I/O is `ctx.fs`);
- read credentials, environment variables, or SSH material;
- run dynamically generated code;
- hide behaviour behind encoded payloads.

## Residual risk

- It runs in the DSH host with workspace-level filesystem access — that is the
  intended function, and the same access the agent already has.
- Supply chain at runtime is nil: the only import is `react`, provided by the
  host as a peer dependency.
- The two `open-*` routes are the sole actions that touch the wider system; they
  are user-triggered and bounded.

## Independent review

Two separate agents audited each half adversarially from the raw files
(host: `src/index.ts` + `lib/index.js`; browser: `src/client/index.ts` +
`lib/client.js`), instructed to assume malice and prove or disprove it.
Findings are folded into the table above.
