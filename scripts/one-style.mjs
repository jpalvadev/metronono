#!/usr/bin/env node
// One-style guard (ADR docs/adr/0007-single-light-theme-token-palette.md).
// Components name token roles only; the theme carries no dead weight; the stylesheet compiles clean.
// Usage: node scripts/one-style.mjs [--audit]
//   default  -> the guard: exits non-zero on any violation (runs inside `npm run check`)
//   --audit  -> prints declared-vs-consumed theme tokens for review, always exits 0

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();

const COMPONENT_RULES = [
  ['raw palette class', /\b(?:teal|rose|amber|emerald|slate|purple)-\d/],
  ['raw scrim or ink', /\b(?:bg-white|text-white|bg-black)\b/],
  ['dark variant', /\bdark:/],
  ['glow literal', /\brgba\(/],
  ['non-square radius', /\brounded(?!-none)/],
];

const THEME_RULES = [
  ['.dark selector block', /^\s*\.dark[^{]*\{/m],
  ['dead --chart-* ramp', /--chart-/],
  ['dead --sidebar-* block', /--sidebar-/],
  ['deprecated darkMode key', /darkMode\s*:/],
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.scratch', '.githooks'].includes(entry.name)) continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/_tests_|\.test\./.test(full)) {
      out.push(full);
    }
  }
  return out;
}

// Class names live in string literals, so only string literals get class rules:
// a domain variable named `rounded` is not a corner radius.
const literalsIn = (line) => {
  const matches = line.match(/(['"`])((?:\\.|(?!\1)[^\r\n])*)\1/g) ?? [];
  return matches.join(' ');
};

const componentFiles = walk(join(ROOT, 'src'));
const violations = [];

for (const file of componentFiles) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    const strings = literalsIn(line);
    if (!strings) return;
    for (const [rule, pattern] of COMPONENT_RULES) {
      if (pattern.test(strings)) violations.push(`${relative(ROOT, file)}:${index + 1}  ${rule}: ${strings.trim()}`);
    }
  });
}

for (const theme of ['src/index.css', 'tailwind.config.js']) {
  const text = readFileSync(join(ROOT, theme), 'utf8');
  for (const [rule, pattern] of THEME_RULES) {
    if (pattern.test(text)) violations.push(`${theme}  ${rule}`);
  }
}

const cli = join(ROOT, 'node_modules/tailwindcss/lib/cli.js');
if (!existsSync(cli)) {
  violations.push('Tailwind CLI missing: node_modules/tailwindcss/lib/cli.js (run npm ci)');
} else {
  const compiled = spawnSync(
    process.execPath,
    [cli, '-i', 'src/index.css', '-o', join(tmpdir(), 'one-style-compiled.css'), '--config', 'tailwind.config.js', '--minify'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  const output = `${compiled.stdout ?? ''}\n${compiled.stderr ?? ''}`;
  const status = compiled.status ?? compiled.exitCode ?? compiled.code;
  if (status !== 0) violations.push(`Tailwind build exited ${status}: ${output.trim()}`);
  const warned = output.split(/\r?\n/).filter((line) => /\bwarn\b/i.test(line));
  if (warned.length) violations.push(`Tailwind build warned: ${warned.join(' | ')}`);
}

if (violations.length) {
  console.log('ONE STYLE BROKEN:\n' + violations.join('\n'));
  process.exit(1);
}

if (!process.argv.includes('--audit')) {
  console.log(`one style holds: ${componentFiles.length} component sources clean, theme compiles with no warnings`);
  process.exit(0);
}

const css = readFileSync(join(ROOT, 'src/index.css'), 'utf8');
const tailwindConfig = readFileSync(join(ROOT, 'tailwind.config.js'), 'utf8');
const componentSource = componentFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
const declared = [...new Set([...css.matchAll(/^\s*--([a-z][a-z-]*):/gm)].map((m) => m[1]))];
const varUsed = new Set([...`${css}\n${tailwindConfig}`.matchAll(/var\(--([a-z-]+)\)/g)].map((m) => m[1]));
const rows = declared.map((token) => {
  const uses = (componentSource.match(new RegExp(`(?:bg|text|border|ring|from|to|divide|outline|fill|stroke)-${token}(?![-\\w])`, 'g')) ?? []).length;
  return `${token.padEnd(22)} ${String(uses).padStart(5)} classes  ${varUsed.has(token) ? 'also via var()' : ''}`;
});
console.log(`token audit over ${declared.length} declared roles (${componentFiles.length} component sources):\n${rows.join('\n')}`);
