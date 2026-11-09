# Model Router: design

Date: 2026-11-09
Status: approved 2026-11-09

## Intent

People burn expensive tokens on cheap work. A button colour change or a two-line
caption runs on the same top model as a hard architecture problem. Model Router
is a skill that any coding agent can load. It sizes up every request and sends
the work to the cheapest model that can do it well: light, regular or heavy.
It keeps switching for the whole conversation, without the user touching the
model picker.

## Goals

- Works with as many agents as possible from day one: Claude Code, Codex,
  Gemini CLI, GitHub Copilot, OpenCode, Cursor, Aider, and manual mode for the rest.
- **Auto mode is the default.** The agent switches models by itself.
- **Manual mode** is available: the agent only suggests the right model in one line.
- Shared project memory, so helpers don't start blind and re-read the whole project.
- The user can always see which model did the work.

## Non-goals

- No proxy server or API-level router (a possible later add-on for API-key users).
- No token dashboards, cost tracking or analytics.
- No custom UI. Everything happens in the conversation.

## Anti-goals (a failure even if it technically works)

- Claiming a switch happened when it didn't. Honesty about what each agent can do
  matters more than coverage.
- Spending more tokens on routing, briefs and memory than the switching saves.
- Light-model results that are quietly worse, with no retry.
- Nagging: a model suggestion on every single message in manual mode.

## How it works

### Tiers

The skill thinks in three tiers, never in brand names:

| Tier | Typical work |
|---|---|
| **Light** | one file, small edit (roughly 20 lines or fewer), clear instruction, no design decision: colour/text/spacing tweaks, renames, typos, formatting, short copy (under ~150 words), simple lookups |
| **Regular** | multi-file features, research with sources, articles and longer writing, explaining code, debugging with a clear error message |
| **Heavy** | architecture and system design, maths/algorithms/calculations, bugs that survived one fix attempt, security-sensitive changes, migrations, large refactors, anything where a wrong answer is costly |

When the signals are mixed, round **up** one tier.

### Routing (auto mode)

1. The main agent reads the request and picks a tier.
2. **Same tier as the main model:** do it directly, with no handoff.
3. **Different tier:** hand it to the matching helper (`router-light`,
   `router-regular`, `router-heavy`) with a sharp brief (below).
4. **Too small to be worth a handoff:** if the brief would be longer than just
   doing the work (for example a one-line edit to a file already in context),
   the main agent does it itself.
5. **Escalation:** if a helper fails, says it is unsure, or the result fails an
   obvious check (doesn't build, doesn't answer the question), retry once on the
   next tier up. Never step down a tier in the middle of a task.
6. Each reply ends with a short tag, for example `[router: light → haiku]`.
7. **Heavy work that needs back-and-forth** (architecture discussions, multi-round
   debugging) is not handed off, because helpers return one result and can't talk
   to the user. Even in auto mode, the agent suggests in one line that the user
   switch the main model to the heavy tier. One-shot heavy work (a calculation, a
   well-specified refactor) still goes to `router-heavy`.

Recommended main model: the **regular** tier (Sonnet on Claude), so routing runs
on a mid-priced model and regular work needs no handoff. The README says this
plainly.

### Sharp briefs

Every handoff includes: the goal in one line, exact files and line numbers when
known, constraints (from memory), and what "done" looks like. The helper should
never need to search for something the main agent already knows.

### Shared memory

File: `.model-router/context.md` in the project root.

```
mode: auto
Project: Next.js site, Tailwind
Key files: app/page.tsx (home), components/Button.tsx
Decisions: brand green = #16a34a, no new dependencies
Current task: redesigning signup flow
```

- Helpers read it before working.
- The main agent updates it when a decision changes, and trims it. **Hard cap: ~40 lines.**
- It never holds secrets, keys, tokens or personal data.
- The skill never edits `.gitignore`. The first time it creates the file, it
  tells the user once that they may want to ignore it.
- Where an agent can keep a helper alive (Claude Code), reuse the same helper
  for follow-up tasks in a session, so it keeps its memory.

### Modes

- `mode: auto` (default): switching as above.
- `mode: manual`: the agent works on whatever model the user picked. When the
  recommended tier differs from the current model, it adds one line at the top:
  `Light task: switch to Haiku to save tokens.` It says this only when the tier
  changes from the previous message, never on every message.
- The user switches by saying `router auto` or `router manual`. The choice is
  saved in the memory file and persists for the project.
- On agents with no helper support, the skill runs in manual mode and says so
  once, plainly.

## Agent support

Based on research on 2026-11-09. Every row must be checked by hand during the build.

| Agent | Skill location | Helper files (one model each) | Mode |
|---|---|---|---|
| Claude Code | `~/.claude/skills/` | `~/.claude/agents/router-*.md`, `model: haiku/sonnet/opus` | Auto |
| Codex | `~/.agents/skills/` | `~/.codex/agents/router-*.toml`, `model = "..."` | Auto |
| Gemini CLI | `~/.gemini/skills/` or `~/.agents/skills/` | `~/.gemini/agents/router-*.md`, `model:` | Auto |
| GitHub Copilot | `~/.copilot/skills/` | `~/.copilot/agents/router-*.md`, `model:` | Auto, unless a handoff counts as an extra premium request (then manual) |
| OpenCode | per its skills docs | `~/.config/opencode/agents/router-*.md`, `model: provider/id` | Auto |
| Cursor | `~/.cursor/skills/` | `~/.cursor/agents/router-*.md`, `model:` (known bug: sometimes ignored) | Auto, manual fallback |
| Aider | no skills; rules go in its conventions file | none per request; its architect/editor/weak-model roles are fixed | Manual (README shows the architect/editor setup as a tip; the installer never edits Aider's config) |
| Windsurf, Cline, Roo, others | rules/`AGENTS.md` file | none confirmed | Manual |

### Tier-to-model table

One file, `tiers.md`, maps tiers to models per provider. Claude uses the stable
aliases `haiku / sonnet / opus`. OpenAI and Google model IDs change often: the
builder fills them in from current vendor docs at build time and never guesses.

## Packaging and install (builder's call, see below)

- Public GitHub repo, MIT licence.
- One folder: `SKILL.md` (shared rules), `tiers.md`, and `adapters/<agent>/`
  holding that agent's helper files.
- A small **Node installer** (`npx model-router install`), so the same command
  works on macOS, Linux and Windows. It detects which agents are installed and
  copies the skill plus helper files into each one's **user-level** folders, so
  it works in every project. It never overwrites a file it didn't create, and
  `npx model-router uninstall` removes everything it added.
- For agents that can run several providers (Copilot, Cursor, OpenCode), the
  installer asks once which provider's models fill the tiers, defaulting to Claude.
- **Always-on trigger (user's decision):** skills only load when a request looks
  relevant, so the router needs one line in each agent's always-loaded file
  (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, Copilot instructions, Cursor rules,
  Windsurf/Cline/Roo rules). The installer **asks before touching each file**,
  then adds a block wrapped in `<!-- model-router:start -->` /
  `<!-- model-router:end -->` markers. If the file doesn't exist, it creates it.
  Uninstall removes exactly that block (or the file, if the installer created it
  and nothing else was added). If the user says no, the README explains that the
  router will only run when called by name.
- A README with the support table, the two modes and the recommended main model.

## Verification

- A file of ~15 sample requests with the expected tier (for example "make the
  signup button green" → light, "design the auth system" → heavy). Used to check
  the routing rules by hand in each agent.
- For each auto-mode agent: confirm in that agent's own UI or logs that the
  helper actually ran on the expected model. The `[router]` tag alone is not proof.
- If an agent's helper ignores its model setting, that agent is listed as manual
  mode until it works.
- Agents that couldn't be tested ship in manual mode, marked "not yet verified"
  in the README, with auto mode available as an opt-in.
- One rough savings check in Claude Code: run the same ~15 sample requests with
  the router on and off, and compare usage in the tool's own usage view. If the
  router doesn't save, tune the "too small to hand off" line before release.

## Decided by the user

- Support every agent from the start.
- Dispatcher approach (helpers inside the agent), not a proxy.
- Three tiers: light (e.g. Haiku), regular (e.g. Sonnet), heavy (e.g. Opus).
- Auto and manual modes, auto by default.
- Shared memory so helpers don't start from scratch.
- Testing: the user can test **Claude Code** only. Claude Code ships in auto mode.
  Every other agent gets the full skill and helper files but defaults to manual
  mode, marked "not yet verified", until someone tests it (users can opt in with
  `router auto`).

## Builder's calls (marked so the user can check them)

- Skill name `model-router`, helper names `router-light/regular/heavy`.
- Public repo, MIT licence, cross-platform Node installer with uninstall.
- Multi-provider agents: installer asks which provider, default Claude.
- Interactive heavy work gets a "switch your main model" suggestion, not a handoff.
- Aider is manual mode; the installer doesn't touch its config.
- Copilot drops to manual if handoffs cost extra premium requests.
- Untested agents ship as manual and "not yet verified".
- One rough on/off savings check in Claude Code.
- Round up when unsure, one escalation retry, ~40-line memory cap.
- Tag at the end of every reply in auto mode.
- Manual mode only speaks when the tier changes.

## Left to the builder

- Exact wording of `SKILL.md` and the helper prompts.
- Exact install paths per agent, after checking each vendor's docs.
- Current OpenAI and Google model IDs.
