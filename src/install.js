import { readFile, writeFile, mkdir, readdir, rm, rmdir, stat } from 'node:fs/promises';
import { join, dirname, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { AGENTS, TIERS } from './agents.js';
import { renderHelper, renderInstructionBlock } from './render.js';
import { addBlock, removeBlock } from './block.js';

const SKILL_SRC = fileURLToPath(new URL('../skill/', import.meta.url));
const abs = (home, rel) => join(home, ...rel.split('/'));
const manifestPath = (home) => join(home, '.model-router', 'manifest.json');
const uniq = (a) => [...new Set(a)];
const sha = (t) => createHash('sha256').update(t).digest('hex');
const inside = (home, p) => { const r = relative(home, p); return r !== '' && !r.startsWith('..') && !isAbsolute(r); };

async function read(p) {
  try { return await readFile(p, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
async function put(p, content) {
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, content);
}
async function loadManifest(home) {
  const t = await read(manifestPath(home));
  const m = t ? JSON.parse(t) : {};
  return { files: m.files || [], blocks: m.blocks || [], createdInstructionFiles: m.createdInstructionFiles || [], hashes: m.hashes || {} };
}

export async function install({ home, ask, log }) {
  const report = { installed: [], skipped: [], blocks: [], warnings: [] };
  const warn = (w) => { report.warnings.push(w); log(`warning: ${w}`); };
  let m;
  try { m = await loadManifest(home); } catch {
    warn(`manifest unreadable at ${manifestPath(home)}, install stopped so earlier files are not lost; fix or delete it and retry`);
    return report;
  }

  // Write one file unless it exists and we didn't put it there.
  async function write(path, content) {
    const cur = await read(path);
    if (cur !== null && !(m.hashes[path] && m.hashes[path] === sha(cur))) {
      report.skipped.push(path);
      warn(`${path} already exists and is not an unedited model-router file; left alone`);
      return;
    }
    await put(path, content);
    m.files.push(path);
    m.hashes[path] = sha(content);
    report.installed.push(path);
  }

  const skillFiles = (await readdir(SKILL_SRC, { withFileTypes: true })).filter((d) => d.isFile()).map((d) => d.name);

  try {
  for (const agent of AGENTS) {
    if (!(await exists(abs(home, agent.detect)))) continue;
    log(`Found ${agent.name}`);

    for (const f of skillFiles) await write(join(abs(home, agent.skillDir), f), await readFile(join(SKILL_SRC, f), 'utf8'));

    const names = Object.keys(agent.providers);
    if (agent.agentsDir && names.length) {
      let name = names[0];
      if (names.length > 1) {
        const a = (await ask(`Which models should ${agent.name} use?`, ['claude', 'openai', 'google'])).trim().toLowerCase();
        name = names.includes(a) ? a : names.includes('claude') ? 'claude' : names[0];
      }
      for (const tier of TIERS) {
        const { file, content } = renderHelper(agent, tier, agent.providers[name][tier]);
        await write(join(abs(home, agent.agentsDir), file), content);
      }
    }

    if (!agent.instructions) {
      log(`To finish, paste this into ${agent.name}'s rules:\n${renderInstructionBlock(agent)}`);
      continue;
    }
    const path = abs(home, agent.instructions);
    const answer = await ask(`Add the model-router line to ${path}?`, ['yes', 'no']);
    if (!/^y/i.test(answer.trim())) {
      warn(`${path} not changed: the router only runs when called by name in ${agent.name}`);
      continue;
    }
    const existing = await read(path);
    let next;
    try {
      next = addBlock(existing ?? '', renderInstructionBlock(agent));
    } catch (e) {
      warn(`${path} has broken model-router markers; left untouched (${e.message})`);
      continue;
    }
    await put(path, next);
    if (existing === null) m.createdInstructionFiles.push(path);
    m.blocks.push(path);
    report.blocks.push(path);
  }
  } finally {
    m.files = uniq(m.files); m.blocks = uniq(m.blocks); m.createdInstructionFiles = uniq(m.createdInstructionFiles);
    if (m.files.length || m.blocks.length) await put(manifestPath(home), JSON.stringify(m, null, 2) + '\n');
  }
  return report;
}

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

export async function uninstall({ home, log }) {
  const report = { installed: [], skipped: [], blocks: [], warnings: [] }; // installed = files removed
  const warn = (w) => { report.warnings.push(w); log(`warning: ${w}`); };
  const t = await read(manifestPath(home));
  if (t === null) { log('Nothing to uninstall'); return report; }
  let m;
  try { m = JSON.parse(t); } catch {
    warn(`manifest unreadable at ${manifestPath(home)}, nothing removed`);
    return report;
  }

  for (const p of m.files || []) {
    if (!inside(home, p)) { warn(`${p} is outside ${home}; left alone`); continue; }
    const cur = await read(p);
    if (cur === null) continue;
    if (!(m.hashes && m.hashes[p] === sha(cur))) { warn(`${p} was edited after install; left alone`); continue; }
    await rm(p);
    report.installed.push(p);
  }

  for (const p of m.blocks || []) {
    if (!inside(home, p)) { warn(`${p} is outside ${home}; left alone`); continue; }
    const text = await read(p);
    if (text === null) continue;
    const r = removeBlock(text);
    if (r.error) { warn(`${p} has broken model-router markers; left untouched, remove the block by hand`); continue; }
    if (r.removed) {
      if ((m.createdInstructionFiles || []).includes(p) && r.text.trim() === '') await rm(p);
      else await writeFile(p, r.text);
      report.blocks.push(p);
    }
  }

  for (const agent of AGENTS) {
    try { await rmdir(abs(home, agent.skillDir)); } catch { /* missing or not empty: keep */ }
  }
  await rm(manifestPath(home));
  try { await rmdir(dirname(manifestPath(home))); } catch { /* not empty */ }
  return report;
}
