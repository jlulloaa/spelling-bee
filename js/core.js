/* Buzzy Spelling Bee - core: word-list helpers, file parsing and the session store.
 * Everything here is kept in memory and mirrored to sessionStorage, so a change lasts
 * only for the current browser session (closing the tab starts fresh).
 */
(function (root) {
  'use strict';
  var SB = root.SB = root.SB || {};

  /* ---------- pure helpers (also unit-tested from Node) ---------- */

  // "Double-Decker" -> "doubledecker". Used to compare spellings and to identify words.
  function wordKey(w) {
    return String(w == null ? '' : w)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z]/g, '');
  }

  function cleanText(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  }

  // Accepts "Word" or {word, definition, partOfSpeech, example} (keys are case-insensitive).
  function normalizeEntry(raw) {
    if (raw == null) return null;
    if (typeof raw === 'string' || typeof raw === 'number') raw = { word: String(raw) };
    if (typeof raw !== 'object') return null;
    var k = {};
    Object.keys(raw).forEach(function (key) {
      k[key.toLowerCase().replace(/[\s_\-]/g, '')] = raw[key];
    });
    var word = cleanText(k.word != null ? k.word : k.palabra);
    if (!wordKey(word)) return null;
    var entry = { word: word };
    var def = cleanText(k.definition != null ? k.definition : (k.definicion != null ? k.definicion : k.meaning));
    var pos = cleanText(k.partofspeech != null ? k.partofspeech : k.pos);
    var ex = cleanText(k.example != null ? k.example : k.ejemplo);
    if (def) entry.definition = def;
    if (pos) entry.partOfSpeech = pos;
    if (ex) entry.example = ex;
    return entry;
  }

  function dedupe(entries) {
    var seen = {};
    var out = [];
    entries.forEach(function (e) {
      var k = wordKey(e.word);
      if (!seen[k]) { seen[k] = true; out.push(e); }
    });
    return out;
  }

  function detectDelimiter(text) {
    var line = '';
    var lines = text.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) { if (lines[i].trim()) { line = lines[i]; break; } }
    var counts = { ',': 0, ';': 0, '\t': 0 };
    var inQ = false;
    for (var j = 0; j < line.length; j++) {
      var c = line[j];
      if (c === '"') inQ = !inQ;
      else if (!inQ && counts.hasOwnProperty(c)) counts[c]++;
    }
    var best = ',';
    Object.keys(counts).forEach(function (d) { if (counts[d] > counts[best]) best = d; });
    return best;
  }

  function parseCSVRows(text, delim) {
    var rows = [];
    var row = [];
    var cell = '';
    var inQ = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false;
        } else cell += c;
      } else if (c === '"') {
        inQ = true;
      } else if (c === delim) {
        row.push(cell); cell = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        rows.push(row); row = [];
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ''; }); });
  }

  // Returns { entries, skipped }. Throws Error('format') when the content is not usable.
  function parseWordFile(text, filename) {
    text = String(text || '').replace(/^﻿/, '');
    var items = [];
    var looksJson = /\.json$/i.test(filename || '') || /^\s*[\[{]/.test(text);
    if (looksJson) {
      var data;
      try { data = JSON.parse(text); } catch (e) { throw new Error('format'); }
      if (Array.isArray(data)) items = data;
      else if (data && Array.isArray(data.words)) items = data.words;
      else throw new Error('format');
    } else {
      var rows = parseCSVRows(text, detectDelimiter(text));
      if (!rows.length) throw new Error('format');
      var header = rows[0].map(function (h) { return h.toLowerCase().replace(/[\s_\-]/g, ''); });
      var hasHeader = header.indexOf('word') > -1 || header.indexOf('palabra') > -1;
      var cols = hasHeader ? header : ['word', 'definition', 'partofspeech', 'example'];
      var body = hasHeader ? rows.slice(1) : rows;
      items = body.map(function (r) {
        var o = {};
        cols.forEach(function (name, idx) { if (name && r[idx] != null) o[name] = r[idx]; });
        return o;
      });
    }
    var normalized = items.map(normalizeEntry).filter(Boolean);
    var entries = dedupe(normalized);
    if (!entries.length) throw new Error('format');
    return { entries: entries, skipped: items.length - entries.length };
  }

  SB.Util = {
    wordKey: wordKey,
    cleanText: cleanText,
    normalizeEntry: normalizeEntry,
    dedupe: dedupe,
    parseCSVRows: parseCSVRows,
    parseWordFile: parseWordFile
  };

  /* ---------- session store ---------- */

  var STORAGE_KEY = 'buzzy-spelling-bee.session.v1';
  var LEVEL_STEPS = [0, 0.1, 0.25, 0.4, 0.6, 0.8, 1]; // share of the list spelt correctly
  var FALLBACK_WORDS = ['Play', 'Horse', 'Mountain', 'Strawberry', 'Elephant', 'Library', 'Tomorrow', 'Umbrella', 'Weight', 'Wonderful'];

  var listeners = [];
  var state = {
    words: [], defaults: [], results: {}, history: [],
    lang: 'es', accent: 'us', sfx: true, source: 'default'
  };
  var currentKey = null;
  var nextKey = null;

  function clone(a) { return a.map(function (e) { return Object.assign({}, e); }); }

  function save() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        words: state.words, results: state.results, history: state.history,
        lang: state.lang, accent: state.accent, sfx: state.sfx, source: state.source
      }));
    } catch (e) { /* storage may be unavailable: the app still works in memory */ }
  }

  function emit(silent) {
    save();
    if (silent) return;
    listeners.slice().forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
  }

  function load() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var s = JSON.parse(raw);
      if (Array.isArray(s.words) && s.words.length) state.words = dedupe(s.words.map(normalizeEntry).filter(Boolean));
      if (s.results && typeof s.results === 'object') state.results = s.results;
      if (Array.isArray(s.history)) state.history = s.history;
      if (s.lang === 'en' || s.lang === 'es') state.lang = s.lang;
      if (s.accent === 'us' || s.accent === 'uk') state.accent = s.accent;
      if (typeof s.sfx === 'boolean') state.sfx = s.sfx;
      if (s.source) state.source = s.source;
    } catch (e) { /* ignore corrupt data */ }
  }

  function init(defaultWords, usedFallback) {
    state.defaults = dedupe((defaultWords || []).map(normalizeEntry).filter(Boolean));
    if (!state.defaults.length) { state.defaults = FALLBACK_WORDS.map(normalizeEntry); usedFallback = true; }
    load();
    if (!state.words.length) { state.words = clone(state.defaults); state.source = 'default'; }
    state.usedFallback = !!usedFallback;
  }

  function keySet() {
    var set = {};
    state.words.forEach(function (w) { set[wordKey(w.word)] = true; });
    return set;
  }

  function remaining() {
    return state.words.filter(function (w) { return !state.results[wordKey(w.word)]; });
  }

  // Looks ahead so the app can pre-load audio and the definition for the next card.
  function peekNext() {
    var pool = remaining().filter(function (w) { return wordKey(w.word) !== currentKey; });
    if (!pool.length) { nextKey = null; return null; }
    var e = nextKey && pool.filter(function (w) { return wordKey(w.word) === nextKey; })[0];
    if (!e) { e = pool[Math.floor(Math.random() * pool.length)]; nextKey = wordKey(e.word); }
    return e;
  }

  function takeNext() {
    var e = peekNext();
    nextKey = null;
    currentKey = e ? wordKey(e.word) : null;
    return e;
  }

  function record(entry, spelled, correct) {
    var key = wordKey(entry.word);
    state.results[key] = { word: entry.word, spelled: spelled, correct: !!correct, at: Date.now() };
    state.history.push({ key: key, correct: !!correct });
    emit();
  }

  function levelFor(correct, total) {
    var share = total ? correct / total : 0;
    var idx = 0;
    for (var i = 0; i < LEVEL_STEPS.length; i++) { if (share >= LEVEL_STEPS[i] - 1e-9) idx = i; }
    var nextIdx = Math.min(idx + 1, LEVEL_STEPS.length - 1);
    var from = Math.ceil(LEVEL_STEPS[idx] * total);
    var to = Math.ceil(LEVEL_STEPS[nextIdx] * total);
    var span = Math.max(1, to - from);
    var progress = idx === LEVEL_STEPS.length - 1 ? 1 : Math.max(0, Math.min(1, (correct - from) / span));
    return { index: idx, last: idx === LEVEL_STEPS.length - 1, nextAt: to, progress: progress };
  }

  function stats() {
    var keys = keySet();
    var total = Object.keys(keys).length;
    var correct = 0, missed = 0;
    Object.keys(state.results).forEach(function (k) {
      if (!keys[k]) return;
      if (state.results[k].correct) correct++; else missed++;
    });
    var played = correct + missed;
    var streak = 0;
    for (var i = state.history.length - 1; i >= 0 && state.history[i].correct; i--) streak++;
    var best = 0, run = 0;
    state.history.forEach(function (h) { run = h.correct ? run + 1 : 0; if (run > best) best = run; });
    return {
      total: total, correct: correct, missed: missed, played: played,
      left: total - played, accuracy: played ? Math.round(correct / played * 100) : 0,
      streak: streak, best: best, level: levelFor(correct, total)
    };
  }

  // Cells for the honeycomb: played words in the order they were first answered, then the rest.
  function honeycomb() {
    var keys = keySet();
    var order = [];
    var seen = {};
    state.history.forEach(function (h) {
      if (keys[h.key] && !seen[h.key] && state.results[h.key]) { seen[h.key] = true; order.push(h.key); }
    });
    var cells = order.map(function (k) { return { state: state.results[k].correct ? 'ok' : 'miss', word: state.results[k].word }; });
    var left = stats().left;
    for (var i = 0; i < left; i++) cells.push({ state: 'left' });
    return cells;
  }

  function lists() {
    var keys = keySet();
    var ok = [], miss = [];
    Object.keys(state.results).forEach(function (k) {
      if (!keys[k]) return;
      (state.results[k].correct ? ok : miss).push(state.results[k]);
    });
    var byTime = function (a, b) { return a.at - b.at; };
    return { correct: ok.sort(byTime), missed: miss.sort(byTime) };
  }

  function requeueMissed() {
    var n = 0;
    Object.keys(state.results).forEach(function (k) {
      if (!state.results[k].correct) { delete state.results[k]; n++; }
    });
    nextKey = null;
    emit();
    return n;
  }

  function resetSession() {
    state.results = {}; state.history = [];
    currentKey = null; nextKey = null;
    emit();
  }

  /* word-list editing */

  function setWords(entries, source) {
    state.words = dedupe(entries);
    state.results = {}; state.history = [];
    state.source = source || 'custom';
    currentKey = null; nextKey = null;
    emit();
  }

  function addWords(entries) {
    var before = state.words.length;
    state.words = dedupe(state.words.concat(entries));
    state.source = 'custom';
    nextKey = null;
    emit();
    return state.words.length - before;
  }

  function removeWordAt(i) {
    var w = state.words[i];
    if (!w) return;
    var k = wordKey(w.word);
    state.words.splice(i, 1);
    delete state.results[k];
    state.source = 'custom';
    nextKey = null;
    emit();
  }

  // Returns 'ok' | 'empty' | 'duplicate'.
  function renameWordAt(i, text) {
    var w = state.words[i];
    var clean = cleanText(text);
    if (!w) return 'empty';
    if (!wordKey(clean)) return 'empty';
    var oldKey = wordKey(w.word), newKey = wordKey(clean);
    if (newKey !== oldKey) {
      if (state.words.some(function (x, idx) { return idx !== i && wordKey(x.word) === newKey; })) return 'duplicate';
      delete state.results[oldKey];
      delete w.definition; delete w.partOfSpeech; delete w.example;
      nextKey = null;
    }
    w.word = clean;
    state.source = 'custom';
    emit(true);
    return 'ok';
  }

  function resetToDefault() {
    state.words = clone(state.defaults);
    state.results = {}; state.history = [];
    state.source = 'default';
    currentKey = null; nextKey = null;
    emit();
  }

  /* settings */
  function set(name, value) { state[name] = value; emit(); }

  SB.Store = {
    init: init,
    on: function (fn) { listeners.push(fn); },
    get: function () { return state; },
    words: function () { return state.words; },
    remaining: remaining,
    peekNext: peekNext,
    takeNext: takeNext,
    record: record,
    stats: stats,
    honeycomb: honeycomb,
    lists: lists,
    requeueMissed: requeueMissed,
    resetSession: resetSession,
    setWords: setWords,
    addWords: addWords,
    removeWordAt: removeWordAt,
    renameWordAt: renameWordAt,
    resetToDefault: resetToDefault,
    set: set
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SB.Util;
})(typeof window !== 'undefined' ? window : globalThis);
