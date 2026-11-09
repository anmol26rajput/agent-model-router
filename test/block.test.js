import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addBlock, removeBlock, MARK_START, MARK_END } from '../src/block.js';

test('appends block to existing text', () => {
  const out = addBlock('# My rules\n', 'use router');
  assert.equal(out, `# My rules\n\n${MARK_START}\nuse router\n${MARK_END}\n`);
});
test('empty file gets block with no leading blank line', () => {
  assert.equal(addBlock('', 'x'), `${MARK_START}\nx\n${MARK_END}\n`);
});
test('adding twice replaces, never duplicates', () => {
  const once = addBlock('a\n', 'v1');
  const twice = addBlock(once, 'v2');
  assert.equal(twice.split(MARK_START).length, 2);
  assert.match(twice, /v2/);
  assert.doesNotMatch(twice, /v1/);
});
test('remove restores the original text', () => {
  assert.deepEqual(removeBlock(addBlock('# My rules\n', 'x')), { text: '# My rules\n', removed: true });
});
test('remove keeps user text after the block', () => {
  const t = addBlock('a\n', 'x') + 'user line\n';
  assert.equal(removeBlock(t).text, 'a\nuser line\n');
});
test('CRLF files stay CRLF', () => {
  const out = addBlock('a\r\n', 'x');
  assert.ok(!/[^\r]\n/.test(out));
  assert.equal(removeBlock(out).text, 'a\r\n');
});
test('unmatched markers: untouched and reported', () => {
  const t = `a\n${MARK_START}\nx\n`;
  assert.deepEqual(removeBlock(t), { text: t, removed: false, error: 'unmatched-markers' });
});
test('no block: removed false', () => {
  assert.deepEqual(removeBlock('a\n'), { text: 'a\n', removed: false });
});
