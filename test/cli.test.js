import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, existsSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cli = (args, opts = {}) => spawnSync(process.execPath, ['bin/model-router.js', ...args], { encoding: 'utf8', timeout: 20000, ...opts });

test('--help exits 0 and lists commands', () => {
  const r = cli(['--help']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /install/);
  assert.match(r.stdout, /uninstall/);
});

test('unknown command exits 1', () => {
  assert.equal(cli(['nope']).status, 1);
});

test('piped yes adds the block; uninstall prints a summary', () => {
  const home = mkdtempSync(join(tmpdir(), 'mr-cli-'));
  try {
    mkdirSync(join(home, '.claude'));
    const r = cli(['install', '--home', home], { input: 'yes\n' });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(home, '.claude/agents/router-heavy.md')));
    assert.match(r.stdout, /Claude Code.*auto/);
    assert.match(readFileSync(join(home, '.claude/CLAUDE.md'), 'utf8'), /model-router:start/);
    const u = cli(['uninstall', '--home', home]);
    assert.equal(u.status, 0, u.stderr);
    assert.match(u.stdout, /Removed: 6 files, 1 blocks, warnings: 0/);
    assert.ok(!existsSync(join(home, '.claude/agents/router-heavy.md')));
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test('closed stdin installs files but does not touch CLAUDE.md', () => {
  const home = mkdtempSync(join(tmpdir(), 'mr-cli-'));
  try {
    mkdirSync(join(home, '.claude'));
    const e = cli(['install', '--home', home], { input: '' });
    assert.equal(e.status, 0, e.stderr);
    assert.ok(existsSync(join(home, '.claude/agents/router-heavy.md')));
    assert.ok(existsSync(join(home, '.claude/skills/model-router/SKILL.md')));
    assert.ok(!existsSync(join(home, '.claude/CLAUDE.md')));
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test('refused install (unreadable manifest) exits 1', () => {
  const home = mkdtempSync(join(tmpdir(), 'mr-cli-'));
  try {
    mkdirSync(join(home, '.claude'));
    mkdirSync(join(home, '.model-router'));
    writeFileSync(join(home, '.model-router/manifest.json'), '{nope');
    const r = cli(['install', '--home', home], { input: 'yes\n' });
    assert.equal(r.status, 1);
    assert.match(r.stdout + r.stderr, /install stopped/);
  } finally { rmSync(home, { recursive: true, force: true }); }
});
