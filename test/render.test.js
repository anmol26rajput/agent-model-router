import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGENTS, TIERS } from '../src/agents.js';
import { renderHelper, renderInstructionBlock } from '../src/render.js';

const helperAgents = AGENTS.filter(a => a.agentsDir);

test('claude tiers are haiku/sonnet/opus', () => {
  const c = AGENTS.find(a => a.id === 'claude');
  assert.deepEqual(c.providers.claude, { light: 'haiku', regular: 'sonnet', heavy: 'opus' });
  assert.equal(c.defaultMode, 'auto');
});
test('only claude defaults to auto', () => {
  assert.deepEqual(AGENTS.filter(a => a.defaultMode === 'auto').map(a => a.id), ['claude']);
});
test('every model string is filled in', () => {
  for (const a of helperAgents) for (const [p, m] of Object.entries(a.providers))
    for (const t of TIERS) assert.ok(m[t] && !/todo|tbd|\?/i.test(m[t]), `${a.id}/${p}/${t}`);
});
test('every agent has a docs URL', () => {
  for (const a of AGENTS) assert.match(a.docs, /^https:\/\//, a.id);
});
test('md helpers carry name, description and model in frontmatter', () => {
  const { file, content } = renderHelper(AGENTS.find(a => a.id === 'claude'), 'light', 'haiku');
  assert.equal(file, 'router-light.md');
  assert.match(content, /^---\nname: router-light\ndescription: .+\nmodel: haiku\n---\n/);
});
test('toml helpers carry name and model', () => {
  const { file, content } = renderHelper(AGENTS.find(a => a.id === 'codex'), 'heavy', 'X');
  assert.equal(file, 'router-heavy.toml');
  assert.match(content, /^name = "router-heavy"$/m);
  assert.match(content, /^model = "X"$/m);
});
test('instruction block names the skill and the default mode', () => {
  for (const a of AGENTS) {
    const b = renderInstructionBlock(a);
    assert.match(b, /model-router/);
    assert.match(b, new RegExp(`default mode: ${a.defaultMode}`, 'i'));
  }
});
test('helper descriptions only invite delegation from the skill, on one line', () => {
  for (const t of ['light', 'regular', 'heavy']) {
    const { content } = renderHelper(AGENTS.find(a => a.id === 'claude'), t, 'x');
    assert.match(content, /^description: Only for tasks handed over by the model-router skill in auto mode\. .+$/m);
    const toml = renderHelper(AGENTS.find(a => a.id === 'codex'), t, 'x').content;
    assert.match(toml, /^description = "Only for tasks handed over by the model-router skill in auto mode\. .+"$/m);
  }
});
test('instruction block loads the skill once per conversation', () => {
  const b = renderInstructionBlock(AGENTS[0]);
  assert.match(b, /Load the `model-router` skill once per conversation, then size every task by its rules\./);
  assert.match(b, /router auto/);
  assert.match(b, /router manual/);
});
test('agents without helpers say manual mode only', () => {
  const none = /No router helpers are installed for this agent: manual mode only\./;
  for (const a of AGENTS) {
    const hasHelpers = a.agentsDir && Object.keys(a.providers).length > 0;
    assert.equal(none.test(renderInstructionBlock(a)), !hasHelpers, a.id);
  }
});
