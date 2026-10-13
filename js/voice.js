/* Buzzy Spelling Bee - voice: letter parsing, speech recognition, pronunciation,
 * dictionary look-ups and the little sound effects. */
(function (root) {
  'use strict';
  var SB = root.SB = root.SB || {};

  /* ---------- turning "double you oh oh dee" into W, O, O, D ---------- */

  var LETTER_NAMES = {
    a: ['ay', 'eh', 'hey', 'hay'],
    b: ['be', 'bee', 'bea'],
    c: ['see', 'sea', 'cee'],
    d: ['dee', 'de'],
    e: ['ee'],
    f: ['eff', 'ef'],
    g: ['gee', 'jee', 'ji'],
    h: ['aitch', 'haitch', 'ach', 'age'],
    i: ['eye', 'aye'],
    j: ['jay', 'jai'],
    k: ['kay', 'kai', 'okay', 'ok'],
    l: ['el', 'ell'],
    m: ['em'],
    n: ['en', 'and', 'in', 'an'],
    o: ['oh', 'owe', '0'],
    p: ['pee', 'pea'],
    q: ['queue', 'cue', 'kew'],
    r: ['are', 'ar'],
    s: ['ess', 'es', 'yes'],
    t: ['tee', 'tea'],
    u: ['you', 'ewe', 'yu'],
    v: ['vee', 've'],
    w: ['dub', 'dubya', 'doubleu', 'doubleyou'],
    x: ['ex'],
    y: ['why', 'wye', 'wy'],
    z: ['zee', 'zed']
  };
  var NAME_TO_LETTER = {};
  Object.keys(LETTER_NAMES).forEach(function (l) {
    NAME_TO_LETTER[l] = l;
    LETTER_NAMES[l].forEach(function (n) { NAME_TO_LETTER[n] = l; });
  });

  function parseLetters(transcript) {
    var tokens = String(transcript || '').toLowerCase()
      .replace(/[^a-z0-9\s\-]/g, ' ')
      .split(/[\s\-]+/).filter(Boolean);
    var letters = [];
    var unparsed = 0;
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t === 'double') {
        var nx = tokens[i + 1];
        if (nx === 'you' || nx === 'u') { letters.push('w'); i++; }
        else if (nx && NAME_TO_LETTER[nx]) { letters.push(NAME_TO_LETTER[nx], NAME_TO_LETTER[nx]); i++; }
        else letters.push('w');
      } else if (NAME_TO_LETTER[t]) {
        letters.push(NAME_TO_LETTER[t]);
      } else if (/^([a-z])\1+$/.test(t)) {
        // "oo" or "ll": the same letter said twice in a row
        for (var j = 0; j < t.length; j++) letters.push(t[0]);
      } else {
        unparsed++;
      }
    }
    return { letters: letters, unparsed: unparsed };
  }

  // The recogniser offers several guesses per phrase; keep the one that reads best as letters.
  function bestParse(alternatives) {
    var best = null;
    (alternatives || []).forEach(function (alt, idx) {
      var p = parseLetters(alt);
      var score = p.letters.length * 10 - p.unparsed * 14 - idx;
      if (!best || score > best.score) best = { score: score, letters: p.letters, unparsed: p.unparsed };
    });
    return best || { letters: [], unparsed: 0 };
  }

  function bestLetters(alternatives) { return bestParse(alternatives).letters; }

  // A segment is one entry of the recogniser's result list. When the browser re-hears the spelling
  // as an ordinary word ("p l a y" -> "play") the new guess has no usable letters: keep what we had.
  function updateSegment(prev, parsed) {
    prev = prev || [];
    if (parsed.unparsed > 0 && parsed.letters.length < prev.length) return prev;
    return parsed.letters;
  }

  function startsWith(longer, shorter) {
    if (shorter.length > longer.length) return false;
    for (var i = 0; i < shorter.length; i++) if (longer[i] !== shorter[i]) return false;
    return true;
  }

  // Joins the segments into one list of letters. Android Chrome repeats the text so far as a new
  // result each time ("p", "p l", "p l a"); with cumulative=true a longer segment that starts with
  // the previous one replaces it. Equal segments are kept (the same letter can be said twice).
  function mergeSegments(segs, cumulative) {
    var blocks = [];
    segs.forEach(function (seg) {
      if (!seg || !seg.length) return;
      var last = blocks[blocks.length - 1];
      if (cumulative && last && seg.length > last.length && startsWith(seg, last)) blocks[blocks.length - 1] = seg;
      else blocks.push(seg);
    });
    return blocks.reduce(function (acc, b) { return acc.concat(b); }, []);
  }

  /* ---------- speech recognition ---------- */

  var SR = root.SpeechRecognition || root.webkitSpeechRecognition;
  var supportsRecognition = !!SR;
  var IS_ANDROID = !!(root.navigator && /Android/i.test(root.navigator.userAgent || ''));

  // handlers: onLetters(array), onEnd(reason, letters), onError(code), optional onReady(bool), onDebug(text)
  function createListener(handlers) {
    var rec = null;
    var base = [];          // letters from earlier recogniser sessions in this turn
    var current = [];       // letters from the running session
    var segs = [];          // per-result letters of the running session
    function dbg(m) { if (handlers.onDebug) handlers.onDebug(m); }
    var silenceTimer = null;
    var running = false;
    var finishing = false;
    var restarts = 0;
    var gotAnything = false;
    var failed = false;
    var startedAt = 0;      // when the child pressed the bee
    var sessionAt = 0;      // when the running recogniser session started
    var quickEnds = 0;      // sessions in a row that died at once without hearing anything
    var readyTimer = null;
    function ready(r) { if (handlers.onReady) handlers.onReady(r); }

    function all() { return base.concat(current); }
    function clearTimer() { if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; } }
    function armTimer(ms) {
      clearTimer();
      silenceTimer = setTimeout(function () { stop('silence'); }, ms);
    }

    function begin() {
      rec = new SR();
      rec.lang = 'en-US';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 5;
      current = []; segs = [];
      sessionAt = Date.now();
      dbg('start session');
      ready(false);
      clearTimeout(readyTimer);
      // Not every browser reports when it starts hearing: assume ready shortly after starting.
      readyTimer = setTimeout(function () { if (running) ready(true); }, 900);
      rec.onaudiostart = function () { clearTimeout(readyTimer); ready(true); };
      rec.onresult = function (ev) {
        var lines = [];
        for (var i = 0; i < ev.results.length; i++) {
          var res = ev.results[i];
          var alts = [];
          for (var j = 0; j < res.length; j++) alts.push(res[j].transcript);
          segs[i] = updateSegment(segs[i], bestParse(alts));
          lines.push(i + (res.isFinal ? 'F' : 'i') + ' "' + alts[0] + '" -> ' + segs[i].join('').toUpperCase());
        }
        segs.length = ev.results.length;
        current = mergeSegments(segs, IS_ANDROID);
        if (current.length) gotAnything = true;
        ready(true);
        armTimer(4000);
        dbg(lines.join(' | '));
        handlers.onLetters(all());
      };
      rec.onerror = function (ev) {
        var code = ev && ev.error;
        dbg('error ' + code);
        if (code === 'aborted') return;
        if (code === 'no-speech') return; // handled when the session ends
        failed = true;
        finish(code === 'not-allowed' || code === 'service-not-allowed' ? 'denied'
          : code === 'audio-capture' ? 'nomic'
          : code === 'network' ? 'network' : 'error');
      };
      rec.onend = function () {
        dbg('session ended');
        ready(false);
        if (!running) return;
        if (finishing) { finish('done'); return; }
        // Phones end a session after every short utterance, so start the next one at once, otherwise
        // the following letter is lost. Give up if sessions keep dying without hearing anything.
        var now = Date.now();
        quickEnds = (!current.length && now - sessionAt < 700) ? quickEnds + 1 : 0;
        var keepGoing = (gotAnything || now - startedAt < 9000) && quickEnds < 5 && now - startedAt < 60000;
        if (keepGoing) {
          base = all();
          try { begin(); }
          catch (e) {
            setTimeout(function () {
              if (!running || finishing) return;
              try { begin(); } catch (e2) { finish(gotAnything ? 'done' : 'error'); }
            }, 250);
          }
          return;
        }
        finish(gotAnything ? 'done' : 'nospeech');
      };
      rec.start();
    }

    function finish(reason) {
      if (!running) return;
      running = false;
      clearTimer();
      clearTimeout(readyTimer);
      try { rec.onend = null; rec.onresult = null; rec.onerror = null; rec.stop(); } catch (e) { /* already stopped */ }
      handlers.onEnd(reason, all());
    }

    function stop(reason) {
      if (!running) return;
      finishing = true;
      clearTimer();
      try { rec.stop(); } catch (e) { finish(reason || 'done'); return; }
      // Some browsers never fire "end" after stop(): make sure we do finish.
      setTimeout(function () { finish(reason || 'done'); }, 900);
    }

    return {
      start: function (existing) {
        base = existing ? existing.slice() : [];
        current = []; restarts = 0; quickEnds = 0; startedAt = Date.now();
        gotAnything = base.length > 0; failed = false; finishing = false;
        running = true;
        try { begin(); } catch (e) { running = false; handlers.onError('error'); return false; }
        armTimer(9000);
        return true;
      },
      stop: function () { stop('done'); },
      cancel: function () {
        running = false; clearTimer();
        try { rec.onend = null; rec.abort(); } catch (e) { /* ignore */ }
      },
      isRunning: function () { return running; }
    };
  }

  /* ---------- dictionary (Wiktionary via dictionaryapi.dev, then Wikipedia) ---------- */

  var dictCache = {};

  function fetchJSON(url, ms) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms || 6000);
    return fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }, function (e) { clearTimeout(timer); throw e; });
  }

  function shorten(s, max) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    if (s.length <= max) return s;
    var cut = s.slice(0, max);
    var dot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
    return (dot > 60 ? cut.slice(0, dot + 1) : cut.replace(/\s+\S*$/, '') + '…');
  }

  function classifyAudio(url) {
    if (/[-_]us\b|[-_]us\./i.test(url)) return 'us';
    if (/[-_](uk|gb)\b|[-_](uk|gb)\./i.test(url)) return 'uk';
    if (/[-_](au|ca|in|ie|nz|za)\b|[-_](au|ca|in|ie|nz|za)\./i.test(url)) return 'other';
    return 'any';
  }

  function fromDictionaryApi(word) {
    var url = 'https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word.toLowerCase());
    return fetchJSON(url).then(function (data) {
      if (!Array.isArray(data) || !data.length) throw new Error('empty');
      var audio = {};
      var defs = [];
      var example = '';
      data.forEach(function (entry) {
        (entry.phonetics || []).forEach(function (p) {
          if (!p.audio) return;
          var u = p.audio.indexOf('//') === 0 ? 'https:' + p.audio : p.audio;
          var kind = classifyAudio(u);
          if (!audio[kind]) audio[kind] = u;
        });
        (entry.meanings || []).forEach(function (m) {
          (m.definitions || []).slice(0, 3).forEach(function (d) {
            if (!d.definition) return;
            defs.push({ pos: m.partOfSpeech || '', text: d.definition, example: d.example || '' });
          });
        });
      });
      // Prefer short, kid-sized definitions, one per part of speech where possible.
      var chosen = [];
      var seenPos = {};
      defs.sort(function (a, b) { return (a.text.length > 150) - (b.text.length > 150); });
      defs.forEach(function (d) {
        if (chosen.length < 2 && !seenPos[d.pos]) { seenPos[d.pos] = true; chosen.push(d); }
      });
      if (!chosen.length) throw new Error('nodef');
      chosen.forEach(function (d) { if (!example && d.example) example = d.example; });
      return {
        source: 'Wiktionary',
        definitions: chosen.map(function (d) { return { pos: d.pos, text: shorten(d.text, 170) }; }),
        example: shorten(example, 160),
        audio: audio
      };
    });
  }

  function fromWikipedia(word) {
    var title = word.replace(/\s+/g, '_');
    var url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title) + '?redirect=true';
    return fetchJSON(url).then(function (d) {
      if (!d || d.type === 'disambiguation' || !d.extract) throw new Error('nowiki');
      return {
        source: 'Wikipedia',
        definitions: [{ pos: '', text: shorten(d.extract, 200) }],
        example: '',
        audio: {}
      };
    });
  }

  // Resolves to { source, definitions:[{pos,text}], example, audio:{us,uk,any,other} }, or null.
  function lookup(entry) {
    var key = entry.word.toLowerCase();
    if (dictCache[key]) return dictCache[key];
    var p = fromDictionaryApi(entry.word)
      .catch(function () { return fromWikipedia(entry.word); })
      .catch(function () { return null; })
      .then(function (info) {
        // A definition written in the word list always wins over the online one.
        if (entry.definition) {
          info = info || { source: '', definitions: [], example: '', audio: {} };
          info = Object.assign({}, info, {
            source: 'list',
            definitions: [{ pos: entry.partOfSpeech || '', text: entry.definition }],
            example: entry.example || info.example || ''
          });
        }
        return info;
      });
    // Remember the settled value so speakWord can run synchronously inside the tap handler.
    p.then(function (v) { p.__value = v; });
    dictCache[key] = p;
    return p;
  }

  /* ---------- pronunciation: recorded audio first, browser voice as the fallback ---------- */

  var audioCache = {};   // url -> HTMLAudioElement
  var voices = [];
  var synth = root.speechSynthesis;

  function refreshVoices() { if (synth) voices = synth.getVoices() || []; }
  if (synth) {
    refreshVoices();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', refreshVoices);
  }

  function pickVoice(accent) {
    var want = accent === 'uk' ? 'en-gb' : 'en-us';
    var en = voices.filter(function (v) { return /^en[-_]/i.test(v.lang); });
    var exact = en.filter(function (v) { return v.lang.toLowerCase().replace('_', '-') === want; });
    var pool = exact.length ? exact : en;
    var nice = pool.filter(function (v) { return /natural|neural|google|samantha|daniel|serena|aria|jenny|online/i.test(v.name); });
    return (nice[0] || pool[0]) || null;
  }

  function speakText(text, accent) {
    if (!synth) return false;
    try {
      synth.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = accent === 'uk' ? 'en-GB' : 'en-US';
      var v = pickVoice(accent);
      if (v) u.voice = v;
      u.rate = 0.8;
      synth.speak(u);
      return true;
    } catch (e) { return false; }
  }

  function audioUrlFor(info, accent) {
    if (!info || !info.audio) return '';
    var a = info.audio;
    return (accent === 'uk' ? (a.uk || a.us) : (a.us || a.uk)) || a.any || a.other || '';
  }

  // Warm up the recorded audio so that pressing the speaker plays instantly.
  function prepare(entry, accent) {
    return lookup(entry).then(function (info) {
      var url = audioUrlFor(info, accent);
      if (url && !audioCache[url]) {
        try {
          var el = new Audio();
          el.preload = 'auto';
          el.src = url;
          audioCache[url] = el;
        } catch (e) { /* ignore */ }
      }
      return info;
    });
  }

  var playing = null;
  function speakWord(entry, accent) {
    stopSpeaking();
    var cached = dictCache[entry.word.toLowerCase()];
    var info = cached && cached.__value;   // set once the look-up has settled
    var url = audioUrlFor(info, accent);
    var fallback = function () { speakText(entry.word, accent); };
    if (url && audioCache[url]) {
      var el = audioCache[url];
      playing = el;
      try {
        el.currentTime = 0;
        var pr = el.play();
        if (pr && pr.catch) pr.catch(fallback);
        el.onerror = fallback;
        return 'recording';
      } catch (e) { fallback(); return 'voice'; }
    }
    fallback();
    return 'voice';
  }

  function stopSpeaking() {
    try { if (synth) synth.cancel(); } catch (e) { /* ignore */ }
    try { if (playing) { playing.pause(); } } catch (e) { /* ignore */ }
  }

  /* ---------- tiny sound effects (no files needed) ---------- */

  var actx = null;
  function tone(freq, start, dur, type, vol) {
    var osc = actx.createOscillator();
    var gain = actx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, actx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(vol || 0.15, actx.currentTime + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + start + dur);
    osc.connect(gain); gain.connect(actx.destination);
    osc.start(actx.currentTime + start);
    osc.stop(actx.currentTime + start + dur + 0.05);
  }
  function sfx(kind) {
    try {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      if (!actx) actx = new AC();
      if (actx.state === 'suspended') actx.resume();
      if (kind === 'win') { tone(523, 0, 0.14, 'triangle'); tone(659, 0.11, 0.14, 'triangle'); tone(784, 0.22, 0.2, 'triangle'); tone(1047, 0.36, 0.32, 'triangle'); }
      else if (kind === 'oops') { tone(330, 0, 0.2, 'sine', 0.13); tone(262, 0.18, 0.32, 'sine', 0.13); }
      else if (kind === 'pop') { tone(880, 0, 0.08, 'sine', 0.1); }
      else if (kind === 'start') { tone(660, 0, 0.09, 'sine', 0.1); tone(880, 0.08, 0.12, 'sine', 0.1); }
    } catch (e) { /* audio is optional */ }
  }

  SB.Voice = {
    parseLetters: parseLetters,
    bestLetters: bestLetters,
    updateSegment: updateSegment,
    mergeSegments: mergeSegments,
    supportsRecognition: supportsRecognition,
    supportsSpeech: !!synth,
    createListener: createListener,
    lookup: function (e) { return lookup(e); },
    prepare: prepare,
    speakWord: speakWord,
    stopSpeaking: stopSpeaking,
    sfx: sfx
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseLetters: parseLetters, bestLetters: bestLetters, bestParse: bestParse, updateSegment: updateSegment, mergeSegments: mergeSegments };
  }
})(typeof window !== 'undefined' ? window : globalThis);
