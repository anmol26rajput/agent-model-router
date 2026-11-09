# Model Router Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `model-router` skill, its three tier helpers for every agent that supports them, and a zero-dependency installer that puts them in place and can take them out again.

**Architecture:** One shared `SKILL.md` holds the routing rules. A single data table (`src/agents.js`) describes each agent: where its skill, helpers and always-on instructions file live, its helper file format, its default mode and its tier models. The installer reads that table, renders helper files from one template, asks before editing instruction files, and records everything it creates in a manifest so uninstall removes only its own work.

**Tech Stack:** Node.js 18+, ES modules, no runtime dependencies, `node:test` for tests.

**Spec:** `docs/specs/2026-11-09-model-router-design.md`

## Global Constraints

- Node 18 or newer; `package.json` has zero `dependencies`.
- Works on macOS, Linux and Windows: build every path with `node:path`, never with hard-coded `/`.
- Skill name `model-router`; helper names `router-light`, `router-regular`, `router-heavy`.
- Tiers are always `light`, `regular`, `heavy`, in that order.
- Claude tier models are the aliases `haiku`, `sonnet`, `opus`.
- OpenAI and Google model IDs come from current vendor docs at build time. Never guess one.
- Default mode: `auto` for Claude Code; `manual` for every other agent ("not yet verified").
- Instruction block markers, exactly: `<!-- model-router:start -->` and `<!-- model-router:end -->`.
- Memory file path: `.model-router/context.md`; cap about 40 lines; never secrets, keys, tokens or personal data.
- Reply tag format: `[router: <tier> → <model>]`.
- Mode switch phrases: `router auto`, `router manual`.
- The installer never overwrites a file it didn't create, never edits `.gitignore`, never edits Aider's config.
- Every instruction-file edit is asked first, per file.
- MIT licence.

## Review Focus

1. **Running `install` twice:** no duplicate block, no duplicate manifest entries, helpers updated in place. (Task 1, Task 4 tests)
2. **Broken markers** (a start marker with no end, for example after a user's hand edit): uninstall leaves that file untouched and reports it. (Task 1, Task 4 tests)
3. **A file named `router-light.md` already exists and isn't ours:** skip it and report it, never overwrite. (Task 4 test)
4. **Windows line endings in an instruction file:** adding and removing the block keeps `\r\n`. (Task 1 test)
5. **User says "no" to the instruction-file question:** skill and helpers still install, the report says the router only runs when called by name, and uninstall doesn't touch that file. (Task 4 test)

---

### Task 1: Repo setup and the instruction block

**Files:**
- Create: `package.json`, `LICENSE`, `.gitignore`
- Create: `src/block.js`
- Test: `test/block.test.js`

**Interfaces:**
- Produces:
  - `MARK_START: string`, `MARK_END: string`
  - `addBlock(text: string, body: string): string`: replaces an existing marked block, otherwise appends one (separated by one blank line; no leading blank line when `text` is empty). Keeps the file's line-ending style.
  - `removeBlock(text: string): { text: string, removed: boolean, error?: 'unmatched-markers' }`: removes the block and the blank line that `addBlock` added before it.

- [ ] **Step 1: Set up the repo**

`git init` inside `model-router/`. `package.json`: `"name": "model-router"`, `"type": "module"`, `"bin": { "model-router": "bin/model-router.js" }`, `"engines": { "node": ">=18" }`, `"scripts": { "test": "node --test" }`, `"files": ["bin", "src", "skill"]`, `"license": "MIT"`, no dependencies. `.gitignore`: `node_modules/`, `.impeccable/`. MIT `LICENSE`, copyright holder left as `<name>` for the user to fill.

- [ ] **Step 2: Write the failing tests**

```js
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL, cannot find module `../src/block.js`

- [ ] **Step 4: Implement `src/block.js`** to the interface above.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: all 8 pass

- [ ] **Step 6: Commit**

```bash
git add package.json LICENSE .gitignore src/block.js test/block.test.js README.md assets docs
git commit -m "feat: repo setup and instruction block add/remove"
```

---

### Task 2: Agent table and helper rendering

**Files:**
- Create: `src/agents.js`, `src/render.js`
- Test: `test/render.test.js`

**Interfaces:**
- Consumes: nothing. `renderInstructionBlock` returns only the block body; Task 4 wraps it with `addBlock`.
- Produces:
  - in `src/agents.js`: `TIERS: ['light', 'regular', 'heavy']`
  - in `src/agents.js`: `AGENTS: Agent[]`, where
    ```
    Agent = {
      id: string, name: string,
      detect: string,              // dir relative to home; agent counts as installed if it exists
      skillDir: string,            // relative to home
      agentsDir: string | null,    // null = no helper support (manual only)
      format: 'md' | 'toml' | null,
      instructions: string | null, // always-on file relative to home; null = print paste-in text instead
      defaultMode: 'auto' | 'manual',
      providers: { [provider: string]: { light: string, regular: string, heavy: string } },
      docs: string                 // URL the paths were checked against
    }
    ```
  - in `src/render.js`: `renderHelper(agent: Agent, tier: string, model: string): { file: string, content: string }`, where `file` is `router-<tier>.md` or `router-<tier>.toml`
  - in `src/render.js`: `renderInstructionBlock(agent: Agent): string`

- [ ] **Step 1: Check every path and model ID against vendor docs**

Fill `AGENTS` with these rows, confirming each value in the agent's current official docs and putting that URL in `docs`. Where a doc says otherwise, the doc wins. Starting values from research on 2026-11-09:

| id | detect | skillDir | agentsDir | format | instructions | defaultMode | providers |
|---|---|---|---|---|---|---|---|
| claude | `.claude` | `.claude/skills/model-router` | `.claude/agents` | md | `.claude/CLAUDE.md` | auto | claude |
| codex | `.codex` | `.agents/skills/model-router` | `.codex/agents` | toml | `.codex/AGENTS.md` | manual | openai |
| gemini | `.gemini` | `.gemini/skills/model-router` | `.gemini/agents` | md | `.gemini/GEMINI.md` | manual | google |
| copilot | `.copilot` | `.copilot/skills/model-router` | `.copilot/agents` | md | check docs | manual | claude, openai, google |
| opencode | `.config/opencode` | check docs | `.config/opencode/agents` | md | `.config/opencode/AGENTS.md` | manual | claude, openai, google |
| cursor | `.cursor` | `.cursor/skills/model-router` | `.cursor/agents` | md | check docs (null if rules are UI-only) | manual | claude, openai, google |
| windsurf | check docs | check docs | null | null | check docs | manual | {} |
| cline | check docs | check docs | null | null | check docs | manual | {} |
| roo | check docs | check docs | null | null | check docs | manual | {} |

Model strings must use each tool's own naming (Claude Code takes `haiku`; OpenCode takes `provider/model-id`; Copilot and Cursor take their own IDs).

- [ ] **Step 2: Write the failing tests**

```js
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL, cannot find module `../src/agents.js`

- [ ] **Step 4: Implement `src/agents.js` and `src/render.js`**

Each helper body has to say: you are the `<tier>` worker; do only the brief you were given; read `.model-router/context.md` first if it exists; don't search for what the brief already tells you; if you can't finish or aren't sure, say so plainly in your first line instead of guessing (the main agent then moves the task up a tier); return a short result that names the files you changed. Add any extra frontmatter fields the agent's docs require (OpenCode: `mode: subagent`).

The instruction block is 3 to 5 lines: before every task, use the `model-router` skill to pick light, regular or heavy; default mode for this agent is `<defaultMode>`; the user switches with `router auto` / `router manual`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/agents.js src/render.js test/render.test.js
git commit -m "feat: agent table and helper rendering"
```

---

### Task 3: The skill itself

**Files:**
- Create: `skill/SKILL.md`, `skill/tiers.md`, `skill/samples.md`
- Test: `test/skill.test.js`

**Interfaces:**
- Produces: the `skill/` folder, which Task 4 copies whole into each agent's `skillDir`.

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const skill = readFileSync('skill/SKILL.md', 'utf8');
const samples = readFileSync('skill/samples.md', 'utf8');

test('frontmatter has name and description', () => {
  assert.match(skill, /^---\nname: model-router\ndescription: .{40,}\n/);
});
test('skill pins the fixed values from the spec', () => {
  for (const s of ['router auto', 'router manual', '.model-router/context.md',
                   '[router:', 'router-light', 'router-regular', 'router-heavy', '40'])
    assert.ok(skill.includes(s), s);
});
test('samples cover all tiers, 15 rows', () => {
  const rows = samples.split('\n').filter(l => /^\| .+ \| (light|regular|heavy) \|$/.test(l));
  assert.equal(rows.length, 15);
  for (const t of ['light', 'regular', 'heavy']) assert.ok(rows.some(r => r.endsWith(`| ${t} |`)), t);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL, ENOENT `skill/SKILL.md`

- [ ] **Step 3: Write `skill/SKILL.md`**

Description (it decides when agents load the skill): `Pick the cheapest model that can do each task well. Use before every task to size it as light, regular or heavy and hand it to the matching router helper. Also handles "router auto" and "router manual".`

The body turns the spec's "How it works" and "Modes" sections into instructions for the agent, in this order: the tier table, with "round up when unsure"; routing steps 1 to 7 from the spec, word for word in meaning; the sharp-brief checklist; memory file rules (path, ~40-line cap, no secrets, mention `.gitignore` once on creation, never edit it); modes and the switch phrases, with the mode stored as the `mode:` line in the memory file and the agent's default taken from its instruction block when there's no file; the tag format. How to hand off: "launch the helper named `router-<tier>` with your agent's subagent feature (Claude Code: the Agent tool with that subagent type; reuse the same helper for follow-ups in a session)." If the agent can't launch a helper on a different model, it is in manual mode and says so once. Point to `tiers.md` for models. Keep the body under 150 lines.

- [ ] **Step 4: Write `skill/tiers.md` and `skill/samples.md`**

`tiers.md`: the spec's tier-to-model table, Claude/OpenAI/Google columns, values matching `src/agents.js`. `samples.md`: a table `| request | tier |` with 15 rows, 5 per tier, including the spec's two examples ("make the signup button green" → light, "design the auth system" → heavy) plus one interactive heavy case marked in the request text as "(should suggest switching, not hand off)".

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add skill test/skill.test.js
git commit -m "feat: model-router skill, tiers and sample requests"
```

---

### Task 4: Install and uninstall

**Files:**
- Create: `src/install.js`
- Test: `test/install.test.js`

**Interfaces:**
- Consumes: `AGENTS`, `TIERS` (Task 2); `renderHelper`, `renderInstructionBlock` (Task 2); `addBlock`, `removeBlock` (Task 1); the `skill/` folder (Task 3).
- Produces:
  - `install({ home: string, ask: (question: string, choices: string[]) => Promise<string>, log: (line: string) => void }): Promise<Report>`
  - `uninstall({ home: string, log: (line: string) => void }): Promise<Report>`
  - `Report = { installed: string[], skipped: string[], blocks: string[], warnings: string[] }` (paths absolute)
  - Manifest at `<home>/.model-router/manifest.json`: `{ files: string[], blocks: string[], createdInstructionFiles: string[] }`

Behaviour:
- An agent is detected when `<home>/<detect>` exists. Undetected agents are ignored.
- For agents with more than one provider, `ask('Which models should <name> use?', ['claude','openai','google'])`; an empty answer means `claude`.
- Copy `skill/*` into `skillDir`, write the 3 helpers into `agentsDir`. A target that exists and isn't in the manifest goes to `skipped` with a warning. One that is in the manifest is overwritten.
- For each non-null `instructions` file: `ask('Add the model-router line to <path>?', ['yes','no'])`. Yes → `addBlock` (create the file if missing and record it in `createdInstructionFiles`). No → add a warning saying the router only runs when called by name there.
- For `instructions: null` with helpers or a skill dir: log the block text with "paste this into <name>'s rules".
- Uninstall: delete manifest files; `removeBlock` each block file (on `unmatched-markers`, leave it and warn); delete a created instruction file if it is now empty or whitespace; remove the skill dirs if empty; delete the manifest.

- [ ] **Step 1: Write the failing tests**

Each test builds a fake home with `mkdtempSync(join(tmpdir(), 'mr-'))`, creates `.claude` (and `.codex` where noted), and passes a scripted `ask` that returns queued answers.

```js
test('installs skill, 3 helpers and block for claude', async () => { /* ask: yes
  assert files exist: .claude/skills/model-router/SKILL.md, .claude/agents/router-{light,regular,heavy}.md
  assert .claude/CLAUDE.md contains MARK_START and "default mode: auto" */ });
test('install twice: one block, no duplicate manifest entries', async () => { /* install, install
  assert CLAUDE.md has exactly one MARK_START; manifest.files has no duplicates */ });
test('foreign router-light.md is skipped, not overwritten', async () => { /* pre-write "mine" to .claude/agents/router-light.md
  assert content still "mine"; report.skipped includes it */ });
test('answer no: skill installed, CLAUDE.md untouched, warning given', async () => { /* pre-write "# rules\n"; ask: no
  assert CLAUDE.md === "# rules\n"; SKILL.md exists; warnings mention "called by name" */ });
test('uninstall restores the user file exactly', async () => { /* pre-write "# rules\n"; install yes; uninstall
  assert CLAUDE.md === "# rules\n"; no router-* files; no manifest */ });
test('uninstall deletes an instruction file it created', async () => { /* no CLAUDE.md beforehand; install yes; uninstall
  assert CLAUDE.md does not exist */ });
test('uninstall leaves broken markers alone and warns', async () => { /* install yes; delete MARK_END line by hand; uninstall
  assert CLAUDE.md unchanged; warnings mention it */ });
test('multi-provider agent asks for provider, default claude', async () => { /* create .copilot; ask answers "" for provider
  assert router-light.md frontmatter model equals AGENTS copilot providers.claude.light */ });
test('undetected agents get nothing', async () => { /* only .claude exists
  assert no .codex or .gemini dirs created */ });
```

Write these out as real assertions; the comments name the setup and the checks.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL, cannot find module `../src/install.js`

- [ ] **Step 3: Implement `src/install.js`** to the interface and behaviour above, with `node:fs/promises` and `node:path`. Locate `skill/` with `new URL('../skill/', import.meta.url)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/install.js test/install.test.js
git commit -m "feat: installer and uninstaller with manifest"
```

---

### Task 5: Command line

**Files:**
- Create: `bin/model-router.js`
- Test: `test/cli.test.js`

**Interfaces:**
- Consumes: `install`, `uninstall` (Task 4).
- Produces: `model-router install [--home <dir>]`, `model-router uninstall [--home <dir>]`, `model-router --help`. `--home` defaults to `os.homedir()` and exists for testing.

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('--help exits 0 and lists commands', () => {
  const r = spawnSync(process.execPath, ['bin/model-router.js', '--help'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /install/);
  assert.match(r.stdout, /uninstall/);
});
test('unknown command exits 1', () => {
  const r = spawnSync(process.execPath, ['bin/model-router.js', 'nope'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
});
test('install with piped answers works end to end', () => {
  // fake home with .claude; input 'yes\n'
  // assert exit 0 and .claude/agents/router-heavy.md exists
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL, the bin file doesn't exist

- [ ] **Step 3: Implement `bin/model-router.js`**

`#!/usr/bin/env node`. `ask` uses `node:readline/promises` and shows the choices, with the first one as the default. At the end, print the report: installed, skipped, warnings, and one line per agent saying auto or manual mode.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add bin test/cli.test.js
git commit -m "feat: command line for install and uninstall"
```

---

### Task 6: Verify in Claude Code and measure savings

Manual, done with the user, because it needs a real Claude Code account.

**Files:**
- Modify: `README.md` (agent table status, "How much will I save?" answer, roadmap boxes)

- [ ] **Step 1: Check the npm name**

Run: `npm view model-router name`
Expected: a 404 means the name is free. If it's taken, pick a new name with the user and change `package.json`, the README commands and the CLI help.

- [ ] **Step 2: Install for real**

Run: `node bin/model-router.js install` and answer yes for `~/.claude/CLAUDE.md`.
Expected: the report lists the skill, 3 helpers and the block; Claude Code is shown as auto.

- [ ] **Step 3: Run the 15 sample requests** in a fresh Claude Code session on Sonnet, inside a throwaway test project.

Expected for each: the tag matches the tier in `samples.md`; for light and one-shot heavy, Claude Code's own transcript shows the `router-light` / `router-heavy` helper running on Haiku / Opus; regular tasks show no handoff; the interactive heavy sample suggests switching instead of handing off. Write down any mismatch and fix the tier wording in `SKILL.md`.

- [ ] **Step 4: Savings check**

Run the same 15 requests in a fresh session with the router uninstalled, on Opus. Compare the two runs in Claude Code's own usage view.
Expected: lower usage with the router. If not, move the "too small to hand off" line in `SKILL.md` and repeat.

- [ ] **Step 5: Update the README** with real results only: mark Claude Code "verified", replace the savings FAQ answer with what was measured and how, tick the roadmap boxes. Add the Aider tip the spec asks for: a short note under "Works with" showing how to set Aider's architect model to a heavy-tier model and its editor model to a light-tier one.

- [ ] **Step 6: Uninstall check**

Run: `node bin/model-router.js uninstall`
Expected: `~/.claude/CLAUDE.md` is exactly as it was before Step 2, and no `router-*` files remain.

- [ ] **Step 7: Commit**

```bash
git add README.md skill/SKILL.md
git commit -m "docs: Claude Code verified, savings results"
```
