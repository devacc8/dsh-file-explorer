import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * Regression tests for the file-type mapping that drives the tree's icons and
 * tones. The shipped helper is extracted verbatim from lib/client.js so the
 * assertions track what the browser actually runs.
 */
const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
const start = source.indexOf('const FILE_TYPES')
const end = source.indexOf('const fmtSize')
assert.ok(start !== -1 && end > start, 'FILE_TYPES/fileTypeOf region found in lib/client.js')
const { fileTypeOf } = new Function(source.slice(start, end) + '\nreturn { fileTypeOf };')()

test('markdown family gets its own tone and glyph', () => {
  for (const name of ['CLAUDE.md', 'README.markdown', 'notes.mdx', 'a.mdown', 'b.mkd']) {
    const t = fileTypeOf(name)
    assert.equal(t.tone, 'md', name)
    assert.equal(t.icon, 'md', name)
    assert.equal(t.fillRule, 'evenodd', name)
  }
})

test('common families map to their tone with the generic glyph', () => {
  const expected = {
    'index.ts': 'code',
    'app.jsx': 'code',
    'package.json': 'json',
    'styles.css': 'style',
    'index.html': 'markup',
    'logo.svg': 'markup',
    'voice.yml': 'data',
    'config.toml': 'data',
    '.env': 'data',
    'run.sh': 'shell',
    'main.py': 'script',
    'main.rs': 'script',
  }
  for (const [name, tone] of Object.entries(expected)) {
    const t = fileTypeOf(name)
    assert.equal(t.tone, tone, name)
    assert.equal(t.icon, 'file', name)
  }
})

test('images get their own glyph', () => {
  const t = fileTypeOf('hero.webp')
  assert.equal(t.tone, 'image')
  assert.equal(t.icon, 'image')
  assert.equal(t.fillRule, 'evenodd')
})

test('unknown and extension-less names fall back to the default tone', () => {
  for (const name of ['LICENSE', 'Makefile', 'archive.zip', 'noext']) {
    assert.equal(fileTypeOf(name).tone, 'default', name)
    assert.equal(fileTypeOf(name).icon, 'file', name)
  }
})

test('matching is case-insensitive', () => {
  assert.equal(fileTypeOf('CLAUDE.MD').tone, 'md')
  assert.equal(fileTypeOf('App.TSX').tone, 'code')
})
