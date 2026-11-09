import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { install, uninstall } from '../src/install.js';
import { MARK_START, MARK_END } from '../src/block.js';
import { AGENTS } from '../src/agents.js';
import { renderHelper } from '../src/render.js';
import { createHash } from 'node:crypto';

const sha = (t) => createHash('sha256').update(t).digest('hex');

const MODEL_Q = /^Which models should/;
const LINE_Q = /^Add the model-router line/;

function setup(dirs = ['.claude']) {
  const home = mkdtempSync(join(tmpdir(), 'mr-'));
  for (const d of dirs) mkdirSync(join(home, d), { recursive: true });
  return home;
}
const scripted = ({ provider = '', line = 'yes' } = {}) => async (q) => (MODEL_Q.test(q) ? provider : LINE_Q.test(q) ? line : '');
const run = (home, opts) => install({ home, ask: scripted(opts), log: () => {} });
const read = (home, ...p) => readFileSync(join(home, ...p), 'utf8');
const has = (home, ...p) => existsSync(join(home, ...p));
const withHome = (dirs, fn) => async () => {
  const home = setup(dirs);
  try { await fn(home); } finally { rmSync(home, { recursive: true, force: true }); }
};

test('installs skill, 3 helpers and block for claude', withHome(['.claude'], async (home) => {
  const r = await run(home);
  assert.ok(has(home, '.claude', 'skills', 'model-router', 'SKILL.md'));
  for (const t of ['light', 'regular', 'heavy']) assert.ok(has(home, '.claude', 'agents', `router-${t}.md`));
  const md = read(home, '.claude', 'CLAUDE.md');
  assert.ok(md.includes(MARK_START));
  assert.ok(/default mode: auto/i.test(md));
  assert.deepEqual(r.blocks, [join(home, '.claude', 'CLAUDE.md')]);
  assert.ok(r.installed.every((p) => p.startsWith(home)));
}));

test('install twice: one block, no duplicate manifest entries', withHome(['.claude'], async (home) => {
  await run(home);
  await run(home);
  assert.equal(read(home, '.claude', 'CLAUDE.md').split(MARK_START).length - 1, 1);
  const m = JSON.parse(read(home, '.model-router', 'manifest.json'));
  for (const k of ['files', 'blocks', 'createdInstructionFiles']) assert.equal(new Set(m[k]).size, m[k].length, k);
  assert.equal(m.createdInstructionFiles.length, 1);
}));

test('foreign router-light.md is skipped, not overwritten', withHome(['.claude'], async (home) => {
  mkdirSync(join(home, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(home, '.claude', 'agents', 'router-light.md'), 'mine');
  const r = await run(home);
  assert.equal(read(home, '.claude', 'agents', 'router-light.md'), 'mine');
  assert.ok(r.skipped.includes(join(home, '.claude', 'agents', 'router-light.md')));
  assert.ok(r.warnings.length > 0);
  await uninstall({ home, log: () => {} });
  assert.equal(read(home, '.claude', 'agents', 'router-light.md'), 'mine');
}));

test('answer no: skill installed, CLAUDE.md untouched, warning given', withHome(['.claude'], async (home) => {
  writeFileSync(join(home, '.claude', 'CLAUDE.md'), '# rules\n');
  const r = await run(home, { line: 'no' });
  assert.equal(read(home, '.claude', 'CLAUDE.md'), '# rules\n');
  assert.ok(has(home, '.claude', 'skills', 'model-router', 'SKILL.md'));
  assert.ok(r.warnings.some((w) => w.includes('called by name')));
  await uninstall({ home, log: () => {} });
  assert.equal(read(home, '.claude', 'CLAUDE.md'), '# rules\n');
}));

test('uninstall restores the user file exactly', withHome(['.claude'], async (home) => {
  writeFileSync(join(home, '.claude', 'CLAUDE.md'), '# rules\n');
  await run(home);
  await uninstall({ home, log: () => {} });
  assert.equal(read(home, '.claude', 'CLAUDE.md'), '# rules\n');
  for (const t of ['light', 'regular', 'heavy']) assert.ok(!has(home, '.claude', 'agents', `router-${t}.md`));
  assert.ok(!has(home, '.model-router', 'manifest.json'));
  assert.ok(!has(home, '.claude', 'skills', 'model-router'));
}));

test('uninstall restores a CRLF user file exactly', withHome(['.claude'], async (home) => {
  writeFileSync(join(home, '.claude', 'CLAUDE.md'), '# rules\r\nmore\r\n');
  await run(home);
  assert.ok(read(home, '.claude', 'CLAUDE.md').includes('\r\n' + MARK_END));
  await uninstall({ home, log: () => {} });
  assert.equal(read(home, '.claude', 'CLAUDE.md'), '# rules\r\nmore\r\n');
}));

test('uninstall deletes an instruction file it created', withHome(['.claude'], async (home) => {
  await run(home);
  assert.ok(has(home, '.claude', 'CLAUDE.md'));
  await uninstall({ home, log: () => {} });
  assert.ok(!has(home, '.claude', 'CLAUDE.md'));
}));

test('uninstall leaves broken markers alone and warns', withHome(['.claude'], async (home) => {
  await run(home);
  const p = join(home, '.claude', 'CLAUDE.md');
  writeFileSync(p, readFileSync(p, 'utf8').split('\n').filter((l) => l !== MARK_END).join('\n'));
  const before = readFileSync(p, 'utf8');
  const r = await uninstall({ home, log: () => {} });
  assert.equal(readFileSync(p, 'utf8'), before);
  assert.ok(r.warnings.some((w) => w.includes(p)));
}));

test('install leaves a file with broken markers untouched and warns', withHome(['.claude'], async (home) => {
  const p = join(home, '.claude', 'CLAUDE.md');
  const broken = `# x\n${MARK_START}\nhalf\n`;
  writeFileSync(p, broken);
  const r = await run(home);
  assert.equal(readFileSync(p, 'utf8'), broken);
  assert.ok(r.warnings.some((w) => w.includes(p)));
  assert.ok(has(home, '.claude', 'skills', 'model-router', 'SKILL.md'));
}));

test('multi-provider agent asks for provider, default claude', withHome(['.copilot'], async (home) => {
  const asked = [];
  await install({ home, log: () => {}, ask: async (q, c) => { asked.push(q); return MODEL_Q.test(q) ? '' : 'yes'; } });
  assert.ok(asked.some((q) => MODEL_Q.test(q)));
  const want = AGENTS.find((a) => a.id === 'copilot').providers.claude.light;
  assert.match(read(home, '.copilot', 'agents', 'router-light.md'), new RegExp(`^model: ${want}$`, 'm'));
}));

test('agents with no providers get skill and block but no helpers', withHome(['.config/opencode'], async (home) => {
  await run(home);
  assert.ok(has(home, '.config', 'opencode', 'skills', 'model-router', 'SKILL.md'));
  assert.ok(!has(home, '.config', 'opencode', 'agents'));
  assert.ok(read(home, '.config', 'opencode', 'AGENTS.md').includes(MARK_START));
}));

test('agent with instructions null logs the block to paste', withHome(['.cursor'], async (home) => {
  const lines = [];
  await install({ home, ask: scripted(), log: (l) => lines.push(l) });
  assert.ok(lines.join('\n').includes("paste this into Cursor's rules"));
  assert.ok(has(home, '.cursor', 'skills', 'model-router', 'SKILL.md'));
}));

test('cline: standalone rules file is created and removed on uninstall', withHome(['.cline'], async (home) => {
  await run(home);
  assert.ok(read(home, '.cline', 'rules', 'model-router.md').includes(MARK_START));
  await uninstall({ home, log: () => {} });
  assert.ok(!has(home, '.cline', 'rules', 'model-router.md'));
}));

test('undetected agents get nothing', withHome(['.claude'], async (home) => {
  await run(home);
  assert.ok(!has(home, '.codex'));
  assert.ok(!has(home, '.gemini'));
}));

test('re-install updates our own older helper in place', withHome(['.claude'], async (home) => {
  await run(home);
  const p = join(home, '.claude', 'agents', 'router-light.md');
  const mp = join(home, '.model-router', 'manifest.json');
  const m = JSON.parse(readFileSync(mp, 'utf8'));
  writeFileSync(p, 'older version');
  m.hashes[p] = sha('older version');
  writeFileSync(mp, JSON.stringify(m));
  const r = await run(home);
  const claude = AGENTS.find((a) => a.id === 'claude');
  assert.equal(readFileSync(p, 'utf8'), renderHelper(claude, 'light', claude.providers.claude.light).content);
  assert.ok(!r.skipped.includes(p));
}));

test('re-install keeps a helper the user edited', withHome(['.claude'], async (home) => {
  await run(home);
  const p = join(home, '.claude', 'agents', 'router-light.md');
  writeFileSync(p, 'edited');
  const r = await run(home);
  assert.equal(readFileSync(p, 'utf8'), 'edited');
  assert.ok(r.skipped.includes(p));
}));

test('uninstall keeps a file edited after install and warns', withHome(['.claude'], async (home) => {
  await run(home);
  const p = join(home, '.claude', 'agents', 'router-light.md');
  writeFileSync(p, 'edited');
  const r = await uninstall({ home, log: () => {} });
  assert.equal(readFileSync(p, 'utf8'), 'edited');
  assert.ok(r.warnings.some((w) => w.includes(p) && w.includes('edited')));
  assert.ok(!has(home, '.claude', 'agents', 'router-heavy.md'));
}));

test('failure mid-install still records what was created', withHome(['.claude', '.codex'], async (home) => {
  let n = 0;
  await assert.rejects(install({ home, log: () => {}, ask: async (q) => { if (++n === 2) throw new Error('boom'); return 'yes'; } }), /boom/);
  const m = JSON.parse(read(home, '.model-router', 'manifest.json'));
  assert.ok(m.files.includes(join(home, '.claude', 'skills', 'model-router', 'SKILL.md')));
  assert.equal(m.blocks.length, 1);
  await uninstall({ home, log: () => {} });
  assert.ok(!has(home, '.claude', 'skills', 'model-router', 'SKILL.md'));
}));

test('corrupt manifest: install refuses, uninstall removes nothing', withHome(['.claude'], async (home) => {
  mkdirSync(join(home, '.model-router'));
  writeFileSync(join(home, '.model-router', 'manifest.json'), '{nope');
  const r = await run(home);
  assert.ok(r.warnings.some((w) => w.includes('manifest unreadable')));
  assert.ok(!has(home, '.claude', 'skills'));
  const u = await uninstall({ home, log: () => {} });
  assert.ok(u.warnings.some((w) => w.includes('manifest unreadable') && w.includes('nothing removed')));
  assert.equal(read(home, '.model-router', 'manifest.json'), '{nope');
}));

test('manifest entries outside home are never touched', withHome(['.claude'], async (home) => {
  const outside = mkdtempSync(join(tmpdir(), 'mr-out-'));
  try {
    const f = join(outside, 'f.txt'); const b = join(outside, 'b.md');
    const blockText = `${MARK_START}\nx\n${MARK_END}\n`;
    writeFileSync(f, 'keep'); writeFileSync(b, blockText);
    mkdirSync(join(home, '.model-router'));
    writeFileSync(join(home, '.model-router', 'manifest.json'),
      JSON.stringify({ files: [f], blocks: [b], createdInstructionFiles: [b], hashes: { [f]: sha('keep') } }));
    const r = await uninstall({ home, log: () => {} });
    assert.equal(readFileSync(f, 'utf8'), 'keep');
    assert.equal(readFileSync(b, 'utf8'), blockText);
    assert.equal(r.warnings.filter((w) => w.includes('outside')).length, 2);
  } finally { rmSync(outside, { recursive: true, force: true }); }
}));
