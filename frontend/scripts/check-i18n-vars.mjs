/**
 * Check the translation keys used by the code: every literal `t('key')` exists in
 * en.json and es.json, and every `{variable}` of those texts is passed by the code.
 *
 *     node scripts/check-i18n-vars.mjs
 *
 * `t('users.joinedOn', { fecha })` with the text "Joined {date}" compiles fine
 * and shows the literal "{date}" on screen. Renaming an object key without
 * renaming the placeholder (or the reverse) breaks a text silently. This reads
 * every `t('key', { ... })` call with an object literal and compares its keys
 * with the placeholders of that key in en.json and es.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const locales = Object.fromEntries(
  ['en', 'es'].map((l) => [l, JSON.parse(fs.readFileSync(path.join(root, 'i18n', 'locales', `${l}.json`), 'utf8'))]),
);
const lookup = (obj, key) => key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
const placeholders = (text) => new Set([...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]));

/** Keys of an object literal source `{ a, b: x, c: f(y) }` (top level only). */
function objectKeys(src) {
  const keys = [];
  let depth = 0;
  let token = '';
  for (const ch of src) {
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if (depth === 0 && ch === ',') { keys.push(token); token = ''; continue; }
    token += ch;
  }
  keys.push(token);
  return keys
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => (k.startsWith('...') ? null : k.match(/^['"]?(\w+)['"]?\s*(:|$)/)?.[1]))
    .filter((k) => k !== undefined);
}

const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) files.push(p);
  }
};
walk(root);

const problems = [];
let calls = 0;
const usedKeys = new Set();
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  // Every literal key must exist in both languages, or the screen shows the key itself.
  for (const m of src.matchAll(/\bt\(\s*'([\w-]+(?:\.[\w-]+)+)'/g)) {
    usedKeys.add(m[1]);
    for (const [lang, dict] of Object.entries(locales)) {
      if (typeof lookup(dict, m[1]) !== 'string') {
        const line = src.slice(0, m.index).split('\n').length;
        problems.push(`${path.relative(root, file)}:${line} ${m[1]} missing in ${lang}.json`);
      }
    }
  }
  for (const m of src.matchAll(/\bt\(\s*'([\w.]+)'\s*,\s*\{/g)) {
    // Object literal starting at the `{` of the match.
    const start = m.index + m[0].length - 1;
    let depth = 0;
    let end = start;
    for (let i = start; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}' && --depth === 0) { end = i; break; }
    }
    const keys = objectKeys(src.slice(start + 1, end));
    if (keys.includes(null)) continue; // spread: keys unknown statically
    calls++;
    for (const [lang, dict] of Object.entries(locales)) {
      const text = lookup(dict, m[1]);
      if (typeof text !== 'string') continue;
      const missing = [...placeholders(text)].filter((p) => !keys.includes(p));
      if (missing.length) {
        const line = src.slice(0, m.index).split('\n').length;
        problems.push(`${path.relative(root, file)}:${line} ${m[1]} (${lang}) needs {${missing.join('}, {')}} but gets ${keys.join(', ') || 'nothing'}`);
      }
    }
  }
}

if (problems.length) {
  console.error('i18n problems:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`i18n: OK (${usedKeys.size} keys used, ${calls} calls with variables)`);
