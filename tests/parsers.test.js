// Run with:  node tests/parsers.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const U = require('../js/core.js');
const V = require('../js/voice.js');
const I18n = require('../js/i18n.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}

console.log('word keys');
test('ignores case, spaces and hyphens', () => {
  assert.equal(U.wordKey('Double-Decker'), 'doubledecker');
  assert.equal(U.wordKey('Coral Reef'), 'coralreef');
  assert.equal(U.wordKey('W-O-O-D'), 'wood');
});

console.log('word files');
test('default list parses (array of strings)', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'data', 'word-list-default.json'), 'utf8');
  const r = U.parseWordFile(text, 'word-list-default.json');
  assert.ok(r.entries.length >= 190, 'expected ~200 words, got ' + r.entries.length);
  assert.equal(r.entries[0].word, 'Play');
});
test('JSON objects with optional fields', () => {
  const r = U.parseWordFile('[{"word":"Moon","definition":"A big rock"},"Camel",{"Word":"Eagle","PartOfSpeech":"noun"}]', 'x.json');
  assert.equal(r.entries.length, 3);
  assert.equal(r.entries[0].definition, 'A big rock');
  assert.equal(r.entries[2].partOfSpeech, 'noun');
});
test('JSON { words: [...] }', () => {
  assert.equal(U.parseWordFile('{"words":["a1b","cat"]}', 'x.json').entries.length, 2);
});
test('CSV with header and quoted commas', () => {
  const csv = 'word,definition,partOfSpeech,example\nCamel,"A large animal, with humps",noun,"The camel ""walked""."\nMoon,,,\n';
  const r = U.parseWordFile(csv, 'w.csv');
  assert.equal(r.entries.length, 2);
  assert.equal(r.entries[0].definition, 'A large animal, with humps');
  assert.equal(r.entries[0].example, 'The camel "walked".');
});
test('CSV without header, semicolon separated, BOM, CRLF', () => {
  const r = U.parseWordFile('﻿Camel;A large animal\r\nMoon;The Earth satellite\r\n', 'w.csv');
  assert.equal(r.entries.length, 2);
  assert.equal(r.entries[1].definition, 'The Earth satellite');
});
test('plain one-word-per-line CSV', () => {
  assert.equal(U.parseWordFile('Moon\nSun\nStar\n', 'w.csv').entries.length, 3);
});
test('duplicates and blanks are skipped', () => {
  const r = U.parseWordFile('["Moon","moon","", "  ", "Sun"]', 'w.json');
  assert.equal(r.entries.length, 2);
  assert.equal(r.skipped, 3);
});
test('garbage throws', () => {
  assert.throws(() => U.parseWordFile('{not json', 'x.json'), /format/);
  assert.throws(() => U.parseWordFile('[]', 'x.json'), /format/);
  assert.throws(() => U.parseWordFile('', 'x.csv'), /format/);
});

console.log('letters from speech');
const L = (s) => V.parseLetters(s).letters.join('').toUpperCase();
test('plain letters', () => assert.equal(L('w o o d'), 'WOOD'));
test('hyphens and dots', () => { assert.equal(L('W-O-O-D'), 'WOOD'); assert.equal(L('w. o. o. d.'), 'WOOD'); });
test('letter names', () => assert.equal(L('double you oh oh dee'), 'WOOD'));
test('double-u', () => assert.equal(L('double-u'), 'W'));
test('"double l" means LL', () => assert.equal(L('b e double l'), 'BELL'));
test('homophones', () => assert.equal(L('see why tea'), 'CYT'));
test('doubled sound "oo"', () => assert.equal(L('w oo d'), 'WOOD'));
test('whole word is not turned into letters', () => assert.equal(L('wood'), ''));
test('best alternative wins', () => {
  assert.equal(V.bestLetters(['wood', 'w o o d', 'would']).join('').toUpperCase(), 'WOOD');
});

console.log('texts');
test('every key used in the code exists in both languages', () => {
  const src = ['app.js', 'index.html'].map((f) => fs.readFileSync(path.join(__dirname, '..', f.endsWith('.js') ? 'js' : '', f), 'utf8')).join('\n');
  const keys = new Set();
  for (const m of src.matchAll(/\bt\('([\w.]+)'/g)) keys.add(m[1]);
  for (const m of src.matchAll(/data-i18n(?:-aria)?="([\w.]+)"/g)) keys.add(m[1]);
  for (const m of src.matchAll(/(?:labelKey|confirmKey|subKey)?\s*,?\s*'((?:res|cfg|home|toast|note|finish|dict|def|verdict|back|tab)\.[\w.]+)'/g)) keys.add(m[1]);
  for (const k of [...keys]) if (k.endsWith('.')) keys.delete(k); // prefixes of keys built at run time
  for (let i = 0; i <= 6; i++) keys.add('level.' + i);
  for (let i = 1; i <= 3; i++) keys.add('cfg.tip.' + i);
  const missing = [];
  for (const k of keys) for (const l of ['es', 'en']) if (I18n.texts[l][k] == null) missing.push(l + ':' + k);
  assert.deepEqual(missing, []);
  assert.deepEqual(Object.keys(I18n.texts.es).sort(), Object.keys(I18n.texts.en).sort());
});
test('placeholders are replaced', () => {
  I18n.setLang('en');
  assert.equal(I18n.t('home.progress', { n: 3, total: 200 }), 'Word 3 of 200');
  I18n.setLang('es');
  assert.equal(I18n.t('home.progress', { n: 3, total: 200 }), 'Palabra 3 de 200');
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
