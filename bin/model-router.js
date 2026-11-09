#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { install, uninstall } from '../src/install.js';
import { AGENTS } from '../src/agents.js';

const HELP = `Usage: model-router <command> [--home <dir>]

Commands:
  install     Install the model-router skill and agents for detected tools
  uninstall   Remove everything model-router installed

Options:
  --home <dir>  Use <dir> instead of your home directory (for testing)
  --help        Show this help
`;

const args = process.argv.slice(2);
const cmd = args[0];
if (cmd === '--help' || cmd === '-h' || cmd === undefined) {
  process.stdout.write(HELP);
  process.exit(cmd === undefined ? 1 : 0);
}
if (cmd !== 'install' && cmd !== 'uninstall') {
  console.error(`Unknown command: ${cmd}\n\n${HELP}`);
  process.exit(1);
}
const hi = args.indexOf('--home');
if (hi !== -1 && !args[hi + 1]) {
  console.error('--home needs a directory\n');
  process.exit(1);
}
const home = hi === -1 ? homedir() : args[hi + 1];
const log = (m) => console.log(m);

// One readline interface per run. The async iterator ends on EOF, so a closed pipe never hangs.
const rl = createInterface({ input: process.stdin });
const lines = rl[Symbol.asyncIterator]();
async function ask(question, choices) {
  for (;;) {
    process.stdout.write(`${question} (${choices.join('/')}, default ${choices[0]}) `);
    const { value, done } = await lines.next();
    if (done) { process.stdout.write('\n'); return choices[0]; }
    const a = value.trim().toLowerCase();
    if (a === '') return choices[0];
    if (choices.includes(a)) return a;
    log(`Please answer one of: ${choices.join(', ')}`);
  }
}

try {
  if (cmd === 'uninstall') await uninstall({ home, log });
  else {
    const r = await install({ home, ask, log });
    log(`\nInstalled: ${r.installed.length}, skipped: ${r.skipped.length}, warnings: ${r.warnings.length}`);
    for (const a of AGENTS) {
      if (existsSync(join(home, a.detect))) log(`${a.name}: ${a.defaultMode} mode`);
    }
  }
} catch (e) {
  console.error(`model-router: ${e.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
