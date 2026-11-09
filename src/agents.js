export const TIERS = ['light', 'regular', 'heavy'];

const claude = { light: 'haiku', regular: 'sonnet', heavy: 'opus' };

// Paths and model IDs checked against vendor docs on 2026-11-09 (see `docs`).
export const AGENTS = [
  {
    id: 'claude', name: 'Claude Code', detect: '.claude',
    skillDir: '.claude/skills/model-router', agentsDir: '.claude/agents', format: 'md',
    instructions: '.claude/CLAUDE.md', defaultMode: 'auto',
    providers: { claude },
    docs: 'https://code.claude.com/docs/en/sub-agents',
  },
  {
    id: 'codex', name: 'Codex CLI', detect: '.codex',
    skillDir: '.agents/skills/model-router', agentsDir: '.codex/agents', format: 'toml',
    instructions: '.codex/AGENTS.md', defaultMode: 'manual',
    providers: { openai: { light: 'gpt-6-luna', regular: 'gpt-6.1-sol', heavy: 'gpt-6-astra' } },
    docs: 'https://learn.chatgpt.com/docs/agent-configuration/subagents',
  },
  {
    id: 'gemini', name: 'Gemini CLI', detect: '.gemini',
    skillDir: '.gemini/skills/model-router', agentsDir: '.gemini/agents', format: 'md',
    instructions: '.gemini/GEMINI.md', defaultMode: 'manual',
    providers: { google: { light: 'gemini-3.5-flash-lite', regular: 'gemini-3.8-flash', heavy: 'gemini-4-argon' } },
    docs: 'https://geminicli.com/docs/core/subagents/',
  },
  {
    id: 'copilot', name: 'GitHub Copilot CLI', detect: '.copilot',
    skillDir: '.copilot/skills/model-router', agentsDir: '.copilot/agents', format: 'md',
    instructions: '.copilot/copilot-instructions.md', defaultMode: 'manual',
    // Display names from the Copilot supported-models page; Gemini dropped (no confirmed light tier).
    providers: {
      claude: { light: 'Claude Haiku 5.5', regular: 'Claude Sonnet 5.5', heavy: 'Claude Opus 5.5' },
      openai: { light: 'GPT-6 Luna', regular: 'GPT-6.1 Sol', heavy: 'GPT-6 Astra' },
    },
    docs: 'https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-custom-agents-for-cli',
  },
  {
    id: 'opencode', name: 'OpenCode', detect: '.config/opencode',
    skillDir: '.config/opencode/skills/model-router', agentsDir: '.config/opencode/agents', format: 'md',
    instructions: '.config/opencode/AGENTS.md', defaultMode: 'manual',
    providers: {}, // no tier set fully confirmed in docs (opus/haiku IDs not shown)
    docs: 'https://opencode.ai/docs/agents/',
  },
  {
    id: 'cursor', name: 'Cursor', detect: '.cursor',
    skillDir: '.cursor/skills/model-router', agentsDir: '.cursor/agents', format: 'md',
    instructions: null, defaultMode: 'manual', // user rules are settings-UI only
    providers: {}, // docs list display names only, not model IDs
    docs: 'https://cursor.com/docs/subagents',
  },
  {
    id: 'windsurf', name: 'Windsurf', detect: '.config/devin',
    skillDir: '.config/devin/skills/model-router', agentsDir: null, format: null,
    instructions: '.devin/global_rules.md', defaultMode: 'manual',
    providers: {},
    docs: 'https://docs.devin.ai/desktop/cascade/memories',
  },
  {
    id: 'cline', name: 'Cline', detect: '.cline',
    skillDir: '.cline/skills/model-router', agentsDir: null, format: null,
    instructions: '.cline/rules/model-router.md', defaultMode: 'manual',
    providers: {},
    docs: 'https://docs.cline.bot/customization/cline-rules',
  },
  {
    id: 'roo', name: 'Roo Code', detect: '.roo',
    skillDir: '.roo/skills/model-router', agentsDir: null, format: null,
    instructions: '.roo/rules/model-router.md', defaultMode: 'manual',
    providers: {},
    docs: 'https://roocodeinc.github.io/Roo-Code/features/custom-instructions',
  },
];
