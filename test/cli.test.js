import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, existsSync, rmSync } from 'node:fs';
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

test('install with piped answers works end to end, EOF uses defaults', () => {
  const home = mkdtempSync(join(tmpdir(), 'mr-cli-'));
  try {
    mkdirSync(join(home, '.claude'));
    const r = cli(['install', '--home', home], { input: 'yes\n' });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(home, '.claude/agents/router-heavy.md')));
    assert.match(r.stdout, /Claude Code.*auto/);
    // empty stdin: must not hang, falls back to defaults
    const e = cli(['install', '--home', home], { input: '' });
    assert.equal(e.status, 0, e.stderr);
    const u = cli(['uninstall', '--home', home]);
    assert.equal(u.status, 0, u.stderr);
    assert.ok(!existsSync(join(home, '.claude/agents/router-heavy.md')));
  } finally { rmSync(home, { recursive: true, force: true }); }
});
