# dsh-file-explorer

> **File Explorer for DeepSeek Harness**: a right-side, resizable file tree with
> Markdown rendering, syntax highlighting, in-panel editing, and one-click open in
> VS Code or the system file manager.

A community plugin for DeepSeek Harness (tagged `dsh-plugin`). This repository is a
**vendored, hardened fork**. Upstream is
[`joejojoking-cloud/dsh-file-explorer`](https://github.com/joejojoking-cloud/dsh-file-explorer);
this fork is frozen (no upstream updates) and adds security fixes, a fully English
UI, and a panel background that matches the Harness theme. See `FORK.md` for the
provenance and the complete patch list, and `AUDIT.md` for the security audit.

It is a global file explorer for DeepSeek Harness: every session gets a folder
toggle in the header that opens a resizable file-tree panel on the **right** of
the page.

## Features

- **Right-side panel** (`shell.overlay`, toggleable). The file tree and the preview
  pane collapse **independently**: each has its own `>` handle on its left edge.
  Collapsing the tree keeps the preview and snaps it to the right edge; collapsing
  the preview keeps every tab, and reopening restores it. Drag the left edge to
  resize (260 to 900 px).
- **Tabbed preview.** Browser-style tabs, one per file, in open order. Clicking a
  background tab does not reorder, the strip scrolls when it overflows, switching
  does not reload, each tab closes with `×`, and closing the last one hides the pane.
- **Double-click the chat area** collapses both panes and applies a **project
  filter**: tabs whose file lives inside the current project folder are kept
  (hidden) and restored when the tree reopens, while tabs from elsewhere are closed.
- **Header:** "Files" plus six icons: VS Code (open the whole workspace in VS Code),
  system file manager (open the current selection: a directory opens directly, a
  file is revealed and highlighted in its folder, nothing selected opens the project
  root), expand/collapse all, refresh, edit, and collapse the file tree (preview
  kept).
- **Search box:** recursively scans the workspace (skips `.git` and `node_modules`,
  capped at 300 matches).
- **File tree:** the root is expanded by default, directories expand and collapse on
  click (lazy), and a single or double click on a file opens it in the preview.
- **Preview:** `.md` files render Markdown (headings, lists, code blocks, quotes,
  links); fenced code blocks are highlighted by language, and other text files are
  highlighted by extension (JSON, YAML, JS, TS, Python, C, C++, Java, Go, Rust,
  Shell, SQL, TOML, INI, CSS, HTML, and more). The edit icon switches to an editable
  textarea and saving writes back to disk; clicking the previewed file again closes
  its tab.
- Files larger than 1 MB report that preview is not supported.

## Install

```sh
dsh plugin --profile web add <path-to-this-package-or-npm-name>
```

Restart the harness afterwards: every session then loads the plugin (host routes
under `/plugins/file-explorer/*` plus the web client panel).

## Layout

- `src/index.ts` - host half (built to `lib/index.js`): the `fs` service plus the
  `webServer` HTTP routes (list, search, read, write, open-vscode, open-folder).
- `src/client/index.ts` - web client half (`tsc` to `lib/client/index.js`, then
  `tsdown` to `lib/client.js`): registers the `shell.overlay` panel and the
  `conversation.session.header.actions` toggle.
- `cordis.patch.yml` - bundle patch that inserts the `file-explorer` row into the
  profile's host composition.

## Development (important)

```sh
pnpm run build        # clean && tsc && tsc -p tsconfig.client.json && tsdown
node --check lib/client.js
pnpm test             # host half unit tests (node --test)
```

**Never edit the artifacts under `lib/` directly**: they are generated from `src/`.
Historically a hand edit put a backtick inside the CSS template literal, which
terminated the template early, produced a `SyntaxError` in the whole bundle, and
made startup report "loaded without registering"; the next build also overwrites
hand edits. Put style and logic changes in `src/`.

Convention already in place: the right-hand padding concession on
`[data-phase=active]` applies **instantly** (no `transition` / `will-change`). An
animated chat column width competes with scroll anchoring while the transcript
streams, which made messages jump, the bottom rise, or the column paint blank.

## Notes specific to this fork

- The client bundle (`lib/client.js`) is hand-patched here, because the upstream
  client build toolchain cannot be installed standalone (its declared
  `@deepseek-ai/dsh-client-*` peers pull an unpublished
  `@deepseek-ai/dsh-compact`). Every client change is mirrored into
  `src/client/index.ts`, so a future build reproduces it.
- The host half is regenerated mechanically: `tsc -p tsconfig.json` reproduces
  `lib/index.js` byte for byte from `src/index.ts` (verified).
- Security fixes and the edit-button fix were also contributed upstream as PRs #7
  and #8; the English UI and the theme-matched panel are intentionally fork-only.
