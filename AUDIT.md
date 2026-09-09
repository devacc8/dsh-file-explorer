# AUDIT — dsh-file-explorer (vendored fork, 0.1.7 + local hardening)

Security audit performed before adopting this plugin as our own and freezing it,
then repeated adversarially. See `FORK.md` for provenance and the patch list.

## Verdict

- **Upstream 0.1.7: NOT safe to freeze as-is.** Two high-severity issues were found
  and reproduced live: unauthenticated arbitrary host file read, and a shell-string
  command-injection path. (An earlier revision of this document claimed "CLEAN" and
  asserted that the plugin "cannot read or write outside the session workspace" and
  had "no shell, no interpolated argv". Those claims were wrong and have been
  corrected below.)
- **This fork: CLEAN for the intended purpose.** Both issues are fixed and verified
  live; see "Fixes" and "Live verification".

There is no malware, no exfiltration, no telemetry, no obfuscation, and no covert
behaviour in either half. The risk was *capability scope*, not intent.

## Scope

| Kind | Files |
|---|---|
| Executes in the DSH host | `lib/index.js` |
| Served to the browser | `lib/client.js` |
| Sources | `src/index.ts`, `src/client/index.ts` |
| Build / deps / tests / composition | `package.json`, `tsdown.config.ts`, `tsconfig*.json`, `test/open-folder.test.mjs`, `cordis.patch.yml` |

Dead build intermediates (`lib/client/index.js` + `.map` + `.d.ts`) were removed.

## Method

1. Full read of both halves (source and the built artifacts that actually run).
2. Pattern scan across every `.ts`/`.js`/`.mjs`/`.json`/`.yml` file for process
   execution, network sinks, raw filesystem access, secret/env access, dynamic code
   evaluation, and obfuscation primitives.
3. Entropy scan for base64/hex-like literals — none.
4. Non-ASCII enumeration — only comments and typographic characters.
5. Provenance: `lib/index.js` vs `src/index.ts` compared token-by-token after
   stripping comments/types — **0 differences** (also reproduced by regenerating
   `lib/index.js` with `tsc`, byte-identical).
6. Live probing of every route against the running DSH server, including
   out-of-workspace paths and cross-origin POSTs.
7. Repository test suite, plus re-runs against the unmodified upstream artifact to
   separate pre-existing failures.
8. Independent adversarial review of each half by a separate agent, instructed to
   assume malice.

## Capability inventory

### Host — `lib/index.js`

Six exact-match routes on the DSH web server, all under `/plugins/file-explorer/`:

| Route | Operation |
|---|---|
| `GET list` | list a directory via `ctx.fs` |
| `GET search` | recursive name search, capped (4000 nodes / 300 matches) |
| `GET read` | read a text file, capped at 1 MB |
| `POST write` | write a text file via `ctx.fs` |
| `POST open-vscode` | launch VS Code (`code`) on a workspace path |
| `POST open-folder` | launch the system file manager (`explorer` / `open` / `xdg-open`) |

- Filesystem access goes through the DSH `ctx.fs` service, never raw `node:fs`; the
  only module import is `node:path` (plus `node:fs/promises`' `realpath` for the
  containment check added by this fork).
- Process launching goes through `subprocess` with argv arrays only. No shell.
- `process.env`: none. Network sinks: none. Secrets access: none.

### Browser — `lib/client.js`

Exactly six network sinks, all relative to the page origin
(`list`/`search`/`read`/`write`/`open-vscode`/`open-folder`). Two slots registered
(`shell.overlay`, `conversation.session.header.actions`) and one disposed
`dblclick` listener scoped to the chat column. No external URLs, no `eval` /
`new Function` / dynamic import, no `sendBeacon` / WebSocket / cookies /
`localStorage`, no obfuscation. HTML is escaped before every markdown insertion.

## Findings

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | **high** | **Unauthenticated arbitrary host read.** Routes passed the raw request path to `ctx.fs.resolve`; the DSH fs sandbox fences writes only, so reads were unconfined. Reproduced live with plain `curl` (no cookie/token): `/etc/hostname`, `/etc/passwd`, `~/.ssh/id_ed25519`, `~/.ssh/config` and `~/.dsh/.credentials.yaml` all returned 200 with contents. | **Fixed** — every path is confined to a registered workspace root (or the host launch directory); existing targets are realpath'd first. Out-of-root now returns 403. |
| 2 | **high** | **Command injection in the shell fallback.** `'"' + path.replace(/"/g, '""') + '"'` interpolated into `Start-Process -FilePath code -ArgumentList <quoted>`; `""` escaping does not neutralize PowerShell `$(...)`/backtick or bash `;`/`#` breakouts. Reachable whenever `code` is not on PATH. | **Fixed** — the `shell` fallback is deleted; launching is argv-only via `subprocess.spawn`. |
| 3 | medium | Windows `cmd /c <code.cmd> <path>` re-parse: a path containing `&` is re-interpreted by cmd.exe (libuv quotes only args with space/tab/quote). | **Fixed** — paths containing control characters, and on Windows `&|<>^%`, are rejected with 400. |
| 4 | medium | **CSRF-able routes.** No `Origin`/content-type check; a cross-origin `text/plain` POST reached `write` (a CORS simple request, no preflight) and created a file. | **Fixed** — POST routes require `application/json` and a same-origin `Origin`; cross-origin POST now 403. |
| 5 | medium | Markdown images loaded any `https?://` URL, so previewing untrusted markdown fired a third-party request leaking IP and the origin `Referer`. | **Fixed** — `referrerpolicy="no-referrer"` + `loading="lazy"` on images and links. The IP itself still reaches the host named in the file text (inherent to remote images). |
| 6 | low | Inline code spans are processed before link/image syntax, so `![x](…)` inside backticks still renders an image. | **Accepted (open)** — cosmetic; fenced code blocks are unaffected. |
| 7 | low | Edit (pencil) button silently did nothing when no file was editable. | **Fixed** — greyed state, tooltip, and a status message. |
| 8 | low (positive) | Writes were already confined by the fs sandbox (`FS_SANDBOX_DENIED` outside the workspace). | **Kept**, and now also checked by the plugin. |
| 9 | info (positive) | No XSS in the client: `escapeHtml` runs before every insertion; link schemes denylisted. | **Kept**, single quote now escaped too. |
| 10 | info | All UI text was Chinese. | **Fixed** — fully English. |
| 11 | info | One test failed on Linux (Windows-only case). | **Fixed** — the test is now platform-explicit; suite is green. |
| 12 | info | Provenance: upstream `.git` removed, no remote; `lib/` was hand-patched and mirrored into `src/`. | **Documented** in `FORK.md`; host parity verified mechanically. |

## Fixes (this fork)

- `src/index.ts` (regenerated into `lib/index.js` by `tsc`): workspace confinement
  helper, argv-only spawning, CSRF gate, path validation, dead `shell` fallback
  removed.
- `src/client/index.ts` + `lib/client.js`: `referrerpolicy` / lazy images,
  `escapeHtml` single quote.
- `test/open-folder.test.mjs`: platform-explicit win32 case plus confinement and
  CSRF tests.

## Live verification

| Probe | Before | After |
|---|---|---|
| `read?path=/etc/hostname` (no auth) | 200 + content | **403** |
| `read?path=~/.ssh/id_ed25519` | 200 + key | **403** |
| `read?path=~/.dsh/.credentials.yaml` | 200 + creds | **403** |
| `list?path=/etc` | 200 + listing | **403** |
| `read?path=<workspace>/CLAUDE.md` | 200 | **200** |
| `list?path=<workspace>` | 200 | **200** |
| `POST write` with `Origin: https://evil.example` | 200, file created | **403** |
| `POST write` with `content-type: text/plain` | 200 | **415** |

`node --test`: 14 pass, 0 fail, 3 skipped (win32-only).

## Explicit non-capabilities (after the fixes)

The plugin cannot:

- send data off the origin (no network code in either half);
- execute arbitrary commands (no shell, no `child_process`, argv arrays only);
- read or write outside a registered workspace root;
- read credentials, environment variables, or SSH material;
- run dynamically generated code;
- hide behaviour behind encoded payloads.

## Residual risk

- It runs in the DSH host with workspace-level filesystem access — intended
  function, and the same access the agent already has.
- Runtime supply chain is nil: the only import is `react`, a host-provided peer.
- `open-vscode` / `open-folder` remain the only actions touching the wider system;
  they are user-triggered, path-confined, and argv-only.
- Finding 6 (inline-code ordering) is open and cosmetic.

## Independent review

Two separate agents audited each half adversarially from the raw files, instructed
to assume malice:

- **Host half — SUSPICIOUS**, explicitly rejecting this document's original "CLEAN"
  claim. It found and live-reproduced findings 1–4 and verified provenance parity.
- **Browser half — CLEAN**, with findings 5–6 and 9 as the only residual items; it
  independently executed the bundle's renderer to confirm escaping.

All of their actionable findings are fixed above.
