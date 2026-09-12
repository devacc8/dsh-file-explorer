import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * Regression tests for the tree's scroll restore after a workspace switch.
 *
 * The save/restore pair lives in the browser bundle, so the shipped code is
 * extracted verbatim and driven with a fake tree element: the interesting
 * behaviour is the retry, because levels arrive lazily and the saved offset is
 * often unreachable at the first paint.
 */
const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
const start = source.indexOf('const treeMemory')
const end = source.indexOf('const store = {')
assert.ok(start !== -1 && end > start, 'tree memory region found in lib/client.js')

const harnessFor = (el) => {
  const doc = { querySelector: () => el }
  const factory = new Function(
    'document',
    source.slice(start, end) +
      '\nreturn { applyPendingScroll, setPending: (v) => { pendingScroll = v }, getPending: () => pendingScroll, scroll: treeScroll };',
  )
  return factory(doc)
}

test('applies the saved offset once the content is tall enough', () => {
  const el = { scrollTop: 0, scrollHeight: 500, clientHeight: 100 }
  const h = harnessFor(el)
  h.setPending(250)
  h.applyPendingScroll()
  assert.equal(el.scrollTop, 250)
  assert.equal(h.getPending(), -1, 'pending cleared after it sticks')
})

test('retries while the tree is still shorter than the saved offset', () => {
  const el = { scrollTop: 0, scrollHeight: 100, clientHeight: 100 }
  const h = harnessFor(el)
  h.setPending(250)
  h.applyPendingScroll()
  assert.equal(el.scrollTop, 0)
  assert.equal(h.getPending(), 250, 'kept for the next attempt')
  // levels finish loading and the content grows
  el.scrollHeight = 500
  h.applyPendingScroll()
  assert.equal(el.scrollTop, 250)
  assert.equal(h.getPending(), -1)
})

test('clamps to the end when the saved offset no longer exists', () => {
  const el = { scrollTop: 0, scrollHeight: 300, clientHeight: 100 }
  const h = harnessFor(el)
  h.setPending(250)
  h.applyPendingScroll()
  assert.equal(el.scrollTop, 200, 'clamped to max scroll')
  assert.equal(h.getPending(), 250, 'stays pending until the retry window expires')
})

test('does nothing when no offset is pending', () => {
  const el = { scrollTop: 40, scrollHeight: 500, clientHeight: 100 }
  const h = harnessFor(el)
  h.setPending(-1)
  h.applyPendingScroll()
  assert.equal(el.scrollTop, 40, 'an untouched tree keeps its position')
})

test('a pending offset of zero settles immediately', () => {
  const el = { scrollTop: 40, scrollHeight: 500, clientHeight: 100 }
  const h = harnessFor(el)
  h.setPending(0)
  h.applyPendingScroll()
  assert.equal(el.scrollTop, 0)
  assert.equal(h.getPending(), -1)
})
