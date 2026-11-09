import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AGENTS } from '../src/agents.js';

const skill = readFileSync('skill/SKILL.md', 'utf8');
const samples = readFileSync('skill/samples.md', 'utf8');
const tiers = readFileSync('skill/tiers.md', 'utf8');

test('frontmatter has name and description', () => {
  assert.match(skill, /^---\nname: model-router\ndescription: .{40,}\n/);
});
test('skill pins the fixed values from the spec', () => {
  for (const s of ['router auto', 'router manual', '.model-router/context.md',
                   '[router:', 'router-light', 'router-regular', 'router-heavy', '40'])
    assert.ok(skill.includes(s), s);
});
test('body is under 150 lines', () => {
  assert.ok(skill.split('\n').length < 150);
});
test('samples cover all tiers, 15 rows', () => {
  const rows = samples.split('\n').filter(l => /^\| .+ \| (light|regular|heavy) \|$/.test(l));
  assert.equal(rows.length, 15);
  for (const t of ['light', 'regular', 'heavy']) assert.ok(rows.some(r => r.endsWith(`| ${t} |`)), t);
});
test('tiers.md lists every model value from agents.js', () => {
  const seen = new Set(AGENTS.flatMap(a => Object.values(a.providers).flatMap(p => Object.values(p))));
  for (const m of seen) assert.ok(tiers.includes(m), m);
});
