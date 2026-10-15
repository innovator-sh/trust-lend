// Fails when the code asks for a translation key that en.json does not define.
// A missing key shows its own name on screen (for example "marketplace.activeLoans").
// Run: npm run check:i18n

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const srcDir = join(root, 'src');
const en = JSON.parse(readFileSync(join(srcDir, 'i18n/locales/en.json'), 'utf8'));

const has = (path) => {
  let cur = en;
  for (const part of path.split('.')) {
    if (cur && typeof cur === 'object' && part in cur) cur = cur[part];
    else return false;
  }
  return typeof cur === 'string' || typeof cur === 'number';
};

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { if (name !== 'locales') walk(full); }
    else if (/\.(jsx?|tsx?)$/.test(name)) files.push(full);
  }
})(srcDir);

const missing = new Map();
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/\bt\(\s*['"]([A-Za-z0-9_.]+)['"]/g)) {
    if (!has(m[1])) {
      if (!missing.has(m[1])) missing.set(m[1], new Set());
      missing.get(m[1]).add(relative(root, file).split(String.fromCharCode(92)).join('/'));
    }
  }
}

if (missing.size) {
  console.error(`Missing ${missing.size} translation key(s) in src/i18n/locales/en.json:`);
  for (const [key, where] of [...missing].sort()) console.error(`  ${key}  <- ${[...where].join(', ')}`);
  process.exit(1);
}
console.log('i18n check passed: every t() key exists in en.json.');
