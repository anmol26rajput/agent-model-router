export const MARK_START = '<!-- model-router:start -->';
export const MARK_END = '<!-- model-router:end -->';

const count = (text, s) => text.split(s).length - 1;
const eolOf = (text) => (text.includes('\r\n') ? '\r\n' : '\n');

// Locate the marked block: { start, end } where end is past the end marker and one trailing EOL.
// Returns null if absent, 'unmatched' if the markers don't pair up exactly.
function find(text) {
  const s = count(text, MARK_START);
  const e = count(text, MARK_END);
  if (s === 0 && e === 0) return null;
  const start = text.indexOf(MARK_START);
  const endMark = text.indexOf(MARK_END);
  if (s !== 1 || e !== 1 || endMark < start) return 'unmatched';
  let end = endMark + MARK_END.length;
  if (text.startsWith('\r\n', end)) end += 2;
  else if (text[end] === '\n') end += 1;
  return { start, end };
}

export function addBlock(text, body) {
  const eol = eolOf(text);
  const block = [MARK_START, ...body.split(/\r?\n/), MARK_END].join(eol) + eol;
  const found = find(text);
  if (found === 'unmatched') throw new Error('unmatched model-router markers');
  if (found) return text.slice(0, found.start) + block + text.slice(found.end);
  if (text === '') return block;
  const base = text.endsWith('\n') ? text : text + eol;
  return base + eol + block;
}

export function removeBlock(text) {
  const found = find(text);
  if (found === null) return { text, removed: false };
  if (found === 'unmatched') return { text, removed: false, error: 'unmatched-markers' };
  const eol = eolOf(text);
  let { start } = found;
  // drop the blank line addBlock put before the block
  if (text.slice(0, start).endsWith(eol + eol)) start -= eol.length;
  return { text: text.slice(0, start) + text.slice(found.end), removed: true };
}
