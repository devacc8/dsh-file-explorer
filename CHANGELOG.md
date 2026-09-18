# Changelog

Upstream history (translated from the original Chinese release notes), followed by
this fork's changes.

## This fork (0.1.7 + hardening)

`FORK.md` lists every patch. Summary:

- **Security (high):** file access is confined to registered workspace roots.
  Upstream forwarded the raw request path to `ctx.fs`, whose sandbox fences writes
  only, so reads reached any path on the host. The shell fallback was also removed,
  so external programs launch with an argv array only.
- **Security (medium):** every route requires the `x-dsh-file-explorer: 1` header
  and rejects a cross-origin `Origin`; POST routes require `application/json`.
- **Markdown:** inline code stays literal; links reject dangerous schemes; images
  and links carry `referrerpolicy="no-referrer"`.
- **UI:** fully English; the edit button is dimmed and disabled when there is
  nothing to edit; the panel background matches the Harness theme in both light and
  dark.
- **Harness 0.1.6 compatibility:** the store fields the tree followed
  (`sessions.current`, `workspaces.recentWorkspaceId`) no longer exist, so the panel
  stayed on the first workspace it had ever resolved. It now follows the session the
  main view retains, with that session's `cwd` as the fallback root, and switching
  projects works again.
- **Tests:** coverage for confinement, CSRF, the header gate and the inline
  renderer. The suite is green (21 pass, 3 win32-only skips).

## Upstream 0.1.7 - tabbed preview and project filtering

- Tabbed preview: browser-style tabs, one per file, in open order. Clicking a
  background tab does not reorder, the strip scrolls on overflow, switching does not
  reload, and tabs close individually.
- The preview pane's `>` / "collapse preview" hides the pane and keeps every tab;
  clicking a file in the tree restores it.
- Double-clicking the chat area collapses both panes and filters tabs by project:
  tabs inside the current project folder are kept and restored when the tree
  reopens, others are closed; switching project or session filters the same way.
- Default widths: tree 227 to 303 px, preview 400 to 600 px.
- Build migration: sources moved to `src/` (`tsc` + `tsdown` produce `lib/`), with a
  build script and dev dependencies; host behaviour unchanged.

Code change: 8102e2d

## Upstream 0.1.6 - independent collapse for tree and preview

- Each pane has its own `>` handle: the preview's closes only the preview, the
  tree's closes only the tree (with both open, the tree's handle sits at the seam
  between preview and tree).
- Collapsing the tree keeps the preview pane and snaps it to the right edge; the
  chat's free space only concedes the width of the visible pane.
- The header `×` closes only the tree (preview kept); double-clicking the chat area
  still collapses both.
- Editor and status state moved into the shared store.

Code change: 473c0e8

## Upstream 0.1.5 - system file manager entry

- A new icon button next to the VS Code button opens the current selection in the
  system file manager.
- A selected directory opens directly; a selected file is revealed and highlighted
  in its folder (Windows Explorer `/select`, macOS Finder `open -R`, Linux opens the
  parent); with nothing selected the project root opens.
- Added the `POST /plugins/file-explorer/open-folder` route (subprocess first, with
  a Windows `Start-Process explorer.exe` fallback).
- Fixed a `"path"` type error caused by treating the FsTarget object returned by
  `fs.resolve` as a string (now uses `fs.processPath`).
- Added 12 `node:test` smoke tests pinning the real fs contract and all three
  platforms, runnable with `npm test`.
- Also includes the unpublished 0.1.4 changes: default panel width narrowed to
  227 px, and stale previews reset when switching projects.

Code change: 042229d

## Upstream 0.1.3 - closing the preview

- Clicking the file being previewed closes the preview (works from the tree and from
  search results).
- A double-click does not close it by accident: a double click within a short delay
  after a single click cancels the close, without flicker.
- Clicking a row in edit mode does not close it, so unsaved edits are not lost.

Code change: 9e1f3ea

## Upstream 0.1.2 - two ways to collapse the sidebar

- With the panel open, a `>` button appears at the middle of its left edge (it moves
  to the preview pane's left edge when the preview is open).
- Double-clicking the chat area collapses the sidebar (interactive elements such as
  inputs, buttons and links are excluded, so double-click-to-select and editing keep
  working).

Code change: 8e68714
