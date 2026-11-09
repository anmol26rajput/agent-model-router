const DESCRIPTIONS = {
  light: 'Only for tasks handed over by the model-router skill in auto mode. Light worker for small, clearly specified tasks. Use when the brief is narrow and low-risk.',
  regular: 'Only for tasks handed over by the model-router skill in auto mode. Regular worker for ordinary multi-file tasks. Use when the brief needs normal engineering judgment.',
  heavy: 'Only for tasks handed over by the model-router skill in auto mode. Heavy worker for hard, ambiguous or high-risk tasks. Use when the brief needs deep reasoning.',
};

function body(tier) {
  return [
    `You are the ${tier} worker. Do only the brief you were given.`,
    'Read .model-router/context.md first if it exists.',
    "Don't search for what the brief already tells you.",
    "If you can't finish or aren't sure, say so plainly in your first line instead of guessing; the main agent will then move the task up a tier.",
    'Return a short result that names the files you changed.',
  ].join('\n');
}

export function renderHelper(agent, tier, model) {
  const name = `router-${tier}`;
  const file = `${name}.${agent.format}`;
  if (agent.format === 'toml') {
    const content = [
      `name = "${name}"`,
      `description = "${DESCRIPTIONS[tier]}"`,
      `model = "${model}"`,
      `developer_instructions = """`,
      body(tier),
      `"""`,
      '',
    ].join('\n');
    return { file, content };
  }
  const extra = agent.id === 'opencode' ? 'mode: subagent\n' : '';
  const content = `---\nname: ${name}\ndescription: ${DESCRIPTIONS[tier]}\nmodel: ${model}\n${extra}---\n${body(tier)}\n`;
  return { file, content };
}

export function renderInstructionBlock(agent) {
  const lines = [
    'Load the `model-router` skill once per conversation, then size every task by its rules.',
    `Default mode: ${agent.defaultMode}.`,
    'The user switches with `router auto` or `router manual`.',
  ];
  if (!agent.agentsDir || Object.keys(agent.providers).length === 0) {
    lines.push('No router helpers are installed for this agent: manual mode only.');
  }
  return lines.join('\n');
}
