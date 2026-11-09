export const TIERS = ['light', 'regular', 'heavy'];

const claude = { light: 'haiku', regular: 'sonnet', heavy: 'opus' };
const google = { light: 'gemini-3.5-flash-lite', regular: 'gemini-3.8-flash', heavy: 'gemini-4-argon' };

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
    providers: { google },
    docs: 'https://geminicli.com/docs/core/subagents/',
  },
  {
    id: 'copilot', name: 'GitHub Copilot CLI', detect: '.copilot',
    skillDir: '.copilot/skills/model-router', agentsDir: '.copilot/agents', format: 'md',
    instructions: '.copilot/copilot-instructions.md', defaultMode: 'manual',
    providers: {
      claude: { light: 'claude-haiku-5.5', regular: 'claude-sonnet-5.5', heavy: 'claude-opus-5.5' },
      openai: { light: 'gpt-6-luna', regular: 'gpt-6.1-sol', heavy: 'gpt-6-astra' },
      google,
    },
    docs: 'https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-custom-agents-for-cli',
  },
  {
    id: 'opencode', name: 'OpenCode', detect: '.config/opencode',
    skillDir: '.config/opencode/skills/model-router', agentsDir: '.config/opencode/agents', format: 'md',
    instructions: '.config/opencode/AGENTS.md', defaultMode: 'manual',
    providers: {
      claude: { light: 'anthropic/claude-haiku-5-5', regular: 'anthropic/claude-sonnet-5-5', heavy: 'anthropic/claude-opus-5-5' },
      openai: { light: 'openai/gpt-6-luna', regular: 'openai/gpt-6.1-sol', heavy: 'openai/gpt-6-astra' },
      google: {
        light: 'google/gemini-3.5-flash-lite', regular: 'google/gemini-3.8-flash', heavy: 'google/gemini-4-argon',
      },
    },
    docs: 'https://opencode.ai/docs/agents/',
  },
  {
    id: 'cursor', name: 'Cursor', detect: '.cursor',
    skillDir: '.cursor/skills/model-router', agentsDir: '.cursor/agents', format: 'md',
    instructions: null, defaultMode: 'manual', // user rules are settings-UI only
    providers: {
      claude: { light: 'claude-haiku-5-5', regular: 'claude-sonnet-5-5', heavy: 'claude-opus-5-5' },
      openai: { light: 'gpt-5.6-luna', regular: 'gpt-5.6-terra', heavy: 'gpt-5.6-sol' },
      google,
    },
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
