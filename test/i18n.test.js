'use strict';
// Every text the scripts pass to the translator, and every data-i18n block in the pages,
// has a Russian version with the same {placeholders}. (Plain page text is translated as
// written; open a page with ?i18n to list any that's missing.)
const test = require('node:test');
const assert = require('node:assert');
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');
const { RU } = require('../public/i18n.js');

const dir = path.join(__dirname, '..', 'public');
const GENERATED = new Set(['report.js', 'i18n.js', 'theme-list.js']);
const sources = readdirSync(dir)
  .filter((f) => (f.endsWith('.js') && !GENERATED.has(f)) || f === 'report-template.html')
  .map((f) => [f, readFileSync(path.join(dir, f), 'utf8')
    // the template's copies of shared.js and i18n.js are checked as their own files
    .replace(/\/\* (SHARED|I18N):BEGIN \*\/[\s\S]*?\/\* \1:END \*\//g, '')]);

const STR = String.raw`'((?:[^'\\]|\\.)*)'`;
const unescape = (s) => s.replace(/\\(.)/g, '$1');
// t('…') / tr('…'), and tr(condition ? '…' : '…')
const direct = new RegExp(String.raw`\b(?:tr|t)\(\s*` + STR, 'g');
const ternary = new RegExp(String.raw`\b(?:tr|t)\([^()'"]*\?\s*` + STR + String.raw`\s*:\s*` + STR, 'g');

function keys() {
  const found = new Map();
  for (const [file, text] of sources) {
    for (const m of text.matchAll(direct)) found.set(unescape(m[1]), file);
    for (const m of text.matchAll(ternary)) { found.set(unescape(m[1]), file); found.set(unescape(m[2]), file); }
  }
  return found;
}
const holes = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('every translated text has a Russian version', () => {
  const missing = [...keys()].filter(([k]) => !(k in RU)).map(([k, f]) => `${f}: ${k}`);
  assert.deepEqual(missing, []);
});

test('Russian keeps the same placeholders', () => {
  const wrong = Object.entries(RU).filter(([en, ru]) => holes(en) !== holes(ru)).map(([en]) => en);
  assert.deepEqual(wrong, []);
});

test('every data-i18n block has a Russian version', () => {
  const pages = ['index.html', 'performance.html', 'report-template.html']
    .map((f) => readFileSync(path.join(dir, f), 'utf8').replace(/\/\* (SHARED|I18N):BEGIN \*\/[\s\S]*?\/\* \1:END \*\//g, '')).join('\n');
  const ids = [...pages.matchAll(/data-i18n="([\w-]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length > 10);
  assert.deepEqual(ids.filter((id) => !(`#${id}` in RU)), []);
});

if (process.env.I18N_LIST) {
  // I18N_LIST=1 node test/i18n.test.js: print the texts still to translate
  for (const [k, f] of keys()) if (!(k in RU)) console.log(`${f}\t${k}`);
}
