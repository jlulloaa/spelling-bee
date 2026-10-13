/* Buzzy Spelling Bee - the app: tabs, the flash card, results and settings. */
(function () {
  'use strict';
  var SB = window.SB;
  var Store = SB.Store, Voice = SB.Voice, M = SB.Mascots, U = SB.Util, I = SB.I18n;
  var t = I.t;

  // Add ?debug to the address to see what the browser's speech recogniser hears.
  var DEBUG = /[?&]debug\b/.test(location.search);
  function dbg(msg) {
    if (!DEBUG) return;
    var box = document.getElementById('debug-log');
    if (!box) {
      box = document.createElement('pre');
      box.id = 'debug-log';
      document.body.appendChild(box);
    }
    box.textContent = (new Date().toLocaleTimeString() + ' ' + msg + '\n' + box.textContent).slice(0, 2400);
  }

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function key(entryOrWord) { return U.wordKey(typeof entryOrWord === 'string' ? entryOrWord : entryOrWord.word); }
  function sfx(kind) { if (Store.get().sfx) Voice.sfx(kind); }

  /* ---------- toasts ---------- */

  function toast(msg, ms) {
    var layer = $('#toast-layer');
    while (layer.children.length > 2) layer.removeChild(layer.firstChild);
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    layer.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    }, ms || 3600);
  }

  // A button that needs a second tap to confirm a destructive action.
  function armConfirm(btn, labelKey, confirmKey, action) {
    var timer = null;
    btn.addEventListener('click', function () {
      if (btn.dataset.armed === '1') {
        clearTimeout(timer);
        btn.dataset.armed = '';
        btn.textContent = t(labelKey);
        action();
        return;
      }
      btn.dataset.armed = '1';
      btn.classList.add('armed');
      btn.textContent = t(confirmKey);
      timer = setTimeout(function () {
        btn.dataset.armed = '';
        btn.classList.remove('armed');
        btn.textContent = t(labelKey);
      }, 3500);
    });
  }

  /* ---------- static text and icons ---------- */

  function applyStatic() {
    document.documentElement.lang = I.lang();
    $$('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    $$('[data-i18n-aria]').forEach(function (el) {
      var s = t(el.getAttribute('data-i18n-aria'));
      el.setAttribute('aria-label', s);
      el.setAttribute('title', s);
    });
  }

  function paintIcons() {
    $$('[data-icon]').forEach(function (el) { el.innerHTML = M.icon(el.getAttribute('data-icon')); });
    $('#brand').innerHTML = '<span class="brand-bee">' + M.bee('happy') + '</span><span class="brand-name">Buzzy Spelling Bee</span>';
    $('#btn-bee').innerHTML = M.bee('idle');
  }

  /* ---------- tabs ---------- */

  var TABS = ['home', 'results', 'config'];
  var currentTab = 'home';

  function showTab(name) {
    if (TABS.indexOf(name) < 0) name = 'home';
    currentTab = name;
    TABS.forEach(function (n) {
      $('#tab-' + n).hidden = n !== name;
      var b = $('#tabbtn-' + n);
      b.setAttribute('aria-selected', n === name ? 'true' : 'false');
      b.tabIndex = n === name ? 0 : -1;
    });
    if (name !== 'home') pauseListening();
    if (name === 'home') syncHome();
    if (name === 'results') renderResults();
    if (name === 'config') renderConfig();
    try { history.replaceState(null, '', '#' + name); } catch (e) { /* file:// or sandboxed */ }
    window.scrollTo(0, 0);
  }

  function wireTabs() {
    $$('.tab-btn').forEach(function (b) {
      b.addEventListener('click', function () { showTab(b.getAttribute('data-tab')); });
      b.addEventListener('keydown', function (e) {
        var i = TABS.indexOf(b.getAttribute('data-tab'));
        var n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
        if (n === null) return;
        e.preventDefault();
        var target = TABS[(n + TABS.length) % TABS.length];
        showTab(target);
        $('#tabbtn-' + target).focus();
      });
    });
  }

  /* =====================================================================
   * HOME - the flash card
   * ===================================================================== */

  var home = {
    entry: null,
    letters: [],
    phase: 'idle',      // idle | listening | typing | captured | back | finished
    correct: false,
    listener: null,
    lastTap: 0,
    micBlocked: false,
    meaningToken: 0,
    spoke: false         // the word has been played, so invite the child to press the bee
  };
  var el = {};

  function canVoice() { return Voice.supportsRecognition && !home.micBlocked; }

  function lettersHtml() {
    if (!home.letters.length) {
      var ph = home.phase === 'listening' ? t('home.listening') : t('home.placeholder');
      return '<span class="ph">' + esc(ph) + '</span>';
    }
    return home.letters.map(function (l) { return '<span class="L">' + esc(l) + '</span>'; })
      .join('<span class="dash">-</span>');
  }

  function renderProgress() {
    var s = Store.stats();
    if (home.phase === 'finished') { el.progress.textContent = t('home.progressDone'); return; }
    var n = Math.min(s.total, home.phase === 'back' ? s.played : s.played + 1);
    el.progress.textContent = t('home.progress', { n: Math.max(1, n), total: s.total });
  }

  function renderFront() {
    var ph = home.phase;
    var finished = ph === 'finished';
    var typing = ph === 'typing';
    var showBox = ph === 'listening' || typing || ph === 'captured';

    el.frontMain.hidden = finished;
    el.finish.hidden = !finished;
    el.beeSlot.hidden = showBox;
    el.spellWrap.hidden = !showBox;

    el.spellInput.hidden = !typing;
    el.spellText.hidden = typing;
    if (typing) {
      if (document.activeElement !== el.spellInput) el.spellInput.value = home.letters.join('');
    } else {
      el.spellText.innerHTML = lettersHtml();
    }
    el.spellBox.classList.toggle('listening', ph === 'listening');
    el.spellBox.classList.toggle('empty', !home.letters.length);
    el.spellBox.setAttribute('aria-label', t(typing ? 'home.boxTyping' : 'home.boxLabel') +
      (home.letters.length ? ' ' + home.letters.join(' ') : ''));
    el.beeHint.hidden = !(ph === 'idle' && home.spoke);
    el.beeHint.innerHTML = '<span class="hint-bee">' + M.bee('wink') + '</span><span>' + esc(t('home.hintSpell')) + '</span>';
    el.hint.hidden = ph !== 'captured';
    el.hint.innerHTML = '<span class="hint-bee">' + M.bee('wink') + '</span><span>' + esc(t('home.hint')) + '</span>';

    el.btnUndo.disabled = !home.letters.length;
    el.btnClear.disabled = !home.letters.length && ph !== 'typing';
    el.btnMic.hidden = !canVoice();
    el.btnMic.classList.toggle('on', ph === 'listening');
    el.btnMic.innerHTML = M.bee(ph === 'listening' ? 'listening' : 'idle');
    var micLabel = t(ph === 'listening' ? 'home.micStop' : 'home.micAgain');
    el.btnMic.setAttribute('aria-label', micLabel);
    el.btnMic.setAttribute('title', micLabel);

    var onBack = ph === 'back';
    var hideChip = onBack || finished || (typing && !canVoice()) || (!canVoice() && ph !== 'idle' && ph !== 'captured');
    el.btnKbd.hidden = hideChip;
    el.btnKbd.innerHTML = '<span class="chip-ico">' + (typing ? '' : M.icon('keyboard')) + '</span>' +
      '<span>' + esc(t(typing ? 'home.useVoice' : 'home.typeInstead')) + '</span>';
    el.btnKbd.hidden = hideChip || (typing && !canVoice());

    el.note.textContent = !Voice.supportsRecognition ? t('note.noVoice') : (home.micBlocked ? t('note.micBlocked') : '');
    renderProgress();
  }

  function setFlipped(f) {
    el.card.classList.toggle('flipped', f);
    el.back.inert = !f;
    el.front.inert = f;
    el.back.setAttribute('aria-hidden', f ? 'false' : 'true');
    el.front.setAttribute('aria-hidden', f ? 'true' : 'false');
  }

  function startRound() {
    var entry = Store.takeNext();
    home.letters = [];
    home.correct = false;
    home.spoke = false;
    if (!entry) {
      home.entry = null;
      home.phase = 'finished';
      renderFinish();
      renderFront();
      return;
    }
    home.entry = entry;
    home.phase = 'idle';
    var accent = Store.get().accent;
    Voice.prepare(entry, accent);
    var nx = Store.peekNext();
    if (nx) Voice.prepare(nx, accent);
    renderFront();
  }

  function resetCardFlow() {
    stopListeningQuietly();
    setFlipped(false);
    startRound();
  }

  // Keeps the card in step with changes made on the other tabs.
  function syncHome() {
    if (!el.card) return;
    if (home.phase === 'finished') {
      if (Store.remaining().length) { setFlipped(false); startRound(); } else { renderFinish(); renderFront(); }
      return;
    }
    var words = Store.words();
    var inList = home.entry && words.some(function (w) { return key(w) === key(home.entry); });
    var hasResult = home.entry && Store.get().results[key(home.entry)];
    if (!home.entry || !inList || (home.phase === 'back' && !hasResult)) { resetCardFlow(); return; }
    renderFront();
  }

  /* --- speaking the word --- */

  function onSpeaker() {
    if (!home.entry) return;
    Voice.speakWord(home.entry, Store.get().accent);
    if (home.phase === 'idle' && !home.spoke) { home.spoke = true; renderFront(); }
    el.btnSpeaker.classList.add('speaking');
    setTimeout(function () { el.btnSpeaker.classList.remove('speaking'); }, 1600);
  }

  /* --- listening to the spelling --- */

  function ensureListener() {
    if (home.listener) return home.listener;
    home.listener = Voice.createListener({
      onDebug: dbg,
      onLetters: function (arr) {
        if (home.phase !== 'listening') return;
        home.letters = arr.map(function (c) { return c.toUpperCase(); });
        renderFront();
      },
      onEnd: function (reason, arr) {
        dbg('end: ' + reason + ' letters=' + arr.join(''));
        if (home.phase !== 'listening') return;
        home.letters = arr.map(function (c) { return c.toUpperCase(); });
        if (!home.letters.length) {
          home.phase = 'idle';
          toast(t('toast.nospeech'));
        } else {
          home.phase = 'captured';
          sfx('pop');
        }
        renderFront();
      },
      onError: function (code) {
        if (home.phase === 'listening') home.phase = home.letters.length ? 'captured' : 'idle';
        if (code === 'denied') { home.micBlocked = true; toast(t('toast.micBlocked'), 5200); startTyping(); return; }
        if (code === 'nomic') { home.micBlocked = true; toast(t('toast.noMic'), 5200); startTyping(); return; }
        if (code === 'network') { toast(t('toast.network'), 5200); startTyping(); return; }
        toast(t('toast.error'));
        renderFront();
      }
    });
    return home.listener;
  }

  function startListening(keep) {
    if (!canVoice()) { startTyping(); return; }
    if (home.phase === 'back' || home.phase === 'finished') return;
    Voice.stopSpeaking();
    if (!keep) home.letters = [];
    home.phase = 'listening';
    renderFront();
    var L = ensureListener();
    if (L.isRunning()) return;
    sfx('start');
    L.start(home.letters);
  }

  function stopListening() {
    if (home.listener && home.listener.isRunning()) home.listener.stop();
  }

  // Stop without reporting anything (used when the card is reset or the tab is left).
  function stopListeningQuietly() {
    if (home.listener && home.listener.isRunning()) home.listener.cancel();
  }

  function pauseListening() {
    if (home.phase === 'listening') {
      stopListeningQuietly();
      home.phase = home.letters.length ? 'captured' : 'idle';
      renderFront();
    }
  }

  function startTyping() {
    if (home.phase === 'back' || home.phase === 'finished') return;
    stopListeningQuietly();
    home.phase = 'typing';
    renderFront();
    try { el.spellInput.focus(); } catch (e) { /* ignore */ }
  }

  function finishTyping() {
    if (home.phase !== 'typing') return;
    home.phase = home.letters.length ? 'captured' : 'idle';
    renderFront();
  }

  function onBee() {
    if (home.phase === 'listening') stopListening(); else startListening(false);
  }

  function onMic() {
    if (home.phase === 'listening') stopListening(); else startListening(true);
  }

  function onUndo() {
    if (home.phase === 'listening') { stopListeningQuietly(); home.phase = 'captured'; }
    home.letters.pop();
    if (home.phase === 'captured' && !home.letters.length) home.phase = 'idle';
    renderFront();
    if (home.phase === 'typing') el.spellInput.focus();
  }

  function onClear() {
    stopListeningQuietly();
    home.letters = [];
    if (home.phase === 'typing') { renderFront(); el.spellInput.focus(); return; }
    if (canVoice()) startListening(false); else startTyping();
  }

  function onChip() {
    if (home.phase === 'typing') startListening(true); else startTyping();
  }

  /* --- tapping the word box: one tap stops, two taps check --- */

  function onBoxTap() {
    if (home.phase === 'typing') { el.spellInput.focus(); return; }
    var now = Date.now();
    var dbl = now - home.lastTap < 450;
    home.lastTap = dbl ? 0 : now;
    if (dbl) { check(); return; }
    if (home.phase === 'listening') stopListening();
    if (home.phase === 'captured') {
      el.hint.classList.remove('nudge');
      void el.hint.offsetWidth;
      el.hint.classList.add('nudge');
    }
  }

  /* --- checking and flipping --- */

  function check() {
    if (!home.entry || !home.letters.length || home.phase === 'back' || home.phase === 'finished') return;
    stopListeningQuietly();
    var spelled = home.letters.join('');
    var correct = key(spelled) === key(home.entry);
    var levelBefore = Store.stats().level.index;
    Store.record(home.entry, spelled, correct);
    var levelAfter = Store.stats().level.index;
    home.phase = 'back';
    home.correct = correct;
    renderBack();
    renderFront();
    setFlipped(true);
    sfx(correct ? 'win' : 'oops');
    if (correct) {
      burst();
      if (levelAfter > levelBefore) {
        setTimeout(function () { toast(t('toast.levelUp', { name: t('level.' + levelAfter) }), 4200); }, 1100);
      }
    }
    setTimeout(function () { try { el.back.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 700);
  }

  function next() {
    if (home.phase !== 'back') return;
    setFlipped(false);
    startRound();
  }

  function mask(text, word) {
    var parts = String(word).split(/[\s\-]+/).filter(Boolean).map(function (p) { return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
    if (!parts.length) return text;
    return String(text).replace(new RegExp('\\b' + parts.join('[\\s\\-]*') + '\\w*', 'gi'), '_____');
  }

  function posLabel(p) { p = String(p || ''); return p.charAt(0).toUpperCase() + p.slice(1); }

  function defsHtml(info, word, maskIt) {
    if (!info || !info.definitions || !info.definitions.length) {
      return '<p class="def-none">' + esc(t('def.none')) + '</p>';
    }
    var out = info.definitions.map(function (d) {
      return '<p class="def">' + (d.pos ? '<b class="pos">' + esc(posLabel(d.pos)) + '</b> ' : '') +
        esc(maskIt ? mask(d.text, word) : d.text) + '</p>';
    }).join('');
    if (info.example) out += '<p class="ex">“' + esc(maskIt ? mask(info.example, word) : info.example) + '”</p>';
    if (info.source && info.source !== 'list') out += '<p class="src">' + esc(t('def.source', { src: info.source })) + '</p>';
    return out;
  }

  function renderBack() {
    var entry = home.entry;
    var ok = home.correct;
    el.verdictBee.innerHTML = M.bee(ok ? 'happy' : 'sad');
    var sub = t(ok ? 'verdict.good.sub' : 'verdict.bad.sub');
    el.verdictBubble.innerHTML = '<span class="v-main">' + esc(t(ok ? 'verdict.good' : 'verdict.bad')) + '</span>' +
      (sub ? '<span class="v-sub">' + esc(sub) + '</span>' : '');
    el.card.classList.toggle('is-right', ok);
    el.card.classList.toggle('is-wrong', !ok);

    var target = key(entry).toUpperCase().split('');
    el.given.innerHTML = home.letters.map(function (l, i) {
      return '<span class="L ' + (l === target[i] ? 'ok' : 'bad') + '">' + esc(l) + '</span>';
    }).join('<span class="dash">-</span>');
    el.given.setAttribute('aria-label', t('back.given') + ' ' + home.letters.join(' '));

    el.answer.innerHTML = '<span class="answer-word">' + esc(entry.word) + '</span>' +
      (ok ? '' : '<span class="answer-letters">' + esc(target.join('-')) + '</span>');

    el.nextHint.textContent = t('back.next');
    el.meaning.innerHTML = '<p class="def-loading">' + esc(t('def.loading')) + '</p>';
    var token = ++home.meaningToken;
    Voice.lookup(entry).then(function (info) {
      if (token !== home.meaningToken) return;
      el.meaning.innerHTML = defsHtml(info, entry.word, false);
    });
  }

  function burst() {
    if (reduceMotion) return;
    var host = $('.card-scene');
    var colors = ['#FFC93C', '#E5383B', '#3DA35D', '#7CC8F0', '#FF9AA2'];
    for (var i = 0; i < 26; i++) {
      var p = document.createElement('i');
      p.className = 'conf';
      var a = Math.random() * Math.PI * 2;
      var d = 90 + Math.random() * 130;
      p.style.setProperty('--dx', Math.round(Math.cos(a) * d) + 'px');
      p.style.setProperty('--dy', Math.round(Math.sin(a) * d - 40) + 'px');
      p.style.setProperty('--rot', Math.round(Math.random() * 540 - 270) + 'deg');
      p.style.setProperty('--c', colors[i % colors.length]);
      host.appendChild(p);
      (function (n) { setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 1500); })(p);
    }
  }

  /* --- the meaning pop-up (before spelling) --- */

  function openDict() {
    if (!home.entry) return;
    var entry = home.entry;
    var dlg = $('#dict-dialog');
    $('#dict-title').textContent = t('dict.title');
    $('#dict-bee').innerHTML = M.bee('wink');
    $('#dict-close').setAttribute('aria-label', t('dict.close'));
    $('#dict-body').innerHTML = '<p class="def-loading">' + esc(t('def.loading')) + '</p>';
    try { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); } catch (e) { dlg.setAttribute('open', ''); }
    Voice.lookup(entry).then(function (info) {
      if (home.entry !== entry) return;
      $('#dict-body').innerHTML = defsHtml(info, entry.word, true);
    });
  }

  function closeDict() {
    var dlg = $('#dict-dialog');
    try { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); } catch (e) { dlg.removeAttribute('open'); }
  }

  /* --- all words finished --- */

  function renderFinish() {
    var s = Store.stats();
    el.finish.innerHTML =
      '<div class="finish-bee">' + M.bee('happy') + '</div>' +
      '<h2>' + esc(t('finish.title')) + '</h2>' +
      '<p>' + esc(t('finish.text', { correct: s.correct, total: s.total })) + '</p>' +
      '<div class="finish-actions">' +
        (s.missed ? '<button class="btn" type="button" data-act="practise">' + esc(t('finish.practise', { n: s.missed })) + '</button>' : '') +
        '<button class="btn alt" type="button" data-act="again">' + esc(t('finish.again')) + '</button>' +
        '<button class="btn ghost" type="button" data-act="results">' + esc(t('finish.results')) + '</button>' +
      '</div>';
  }

  function practiseMissed() {
    var n = Store.requeueMissed();
    if (n) toast(t('toast.missedBack', { n: n }));
    showTab('home');
  }

  function startOver() {
    Store.resetSession();
    resetCardFlow();
    toast(t('toast.restarted'));
    if (currentTab === 'results') renderResults();
  }

  function wireHome() {
    el.card = $('#card'); el.front = $('#card-front'); el.back = $('#card-back');
    el.frontMain = $('#front-main'); el.finish = $('#finish-panel');
    el.beeSlot = $('#bee-slot'); el.slotSpell = $('#slot-spell');
    el.spellWrap = $('#spell-wrap'); el.spellBox = $('#spell-box');
    el.spellText = $('#spell-text'); el.spellInput = $('#spell-input');
    el.hint = $('#hint-bubble'); el.beeHint = $('#bee-hint');
    el.btnSpeaker = $('#btn-speaker'); el.btnBee = $('#btn-bee'); el.btnDict = $('#btn-dict');
    el.btnMic = $('#btn-mic'); el.btnUndo = $('#btn-undo'); el.btnClear = $('#btn-clear');
    el.btnKbd = $('#btn-kbd'); el.note = $('#home-note'); el.progress = $('#home-progress');
    el.verdictBee = $('#verdict-bee'); el.verdictBubble = $('#verdict-bubble');
    el.given = $('#given'); el.answer = $('#answer'); el.meaning = $('#meaning'); el.nextHint = $('#next-hint');

    el.btnSpeaker.addEventListener('click', onSpeaker);
    el.btnBee.addEventListener('click', onBee);
    el.btnDict.addEventListener('click', openDict);
    el.btnMic.addEventListener('click', onMic);
    el.btnUndo.addEventListener('click', onUndo);
    el.btnClear.addEventListener('click', onClear);
    el.btnKbd.addEventListener('click', onChip);

    el.spellBox.addEventListener('click', onBoxTap);
    el.spellBox.addEventListener('keydown', function (e) {
      if (e.target !== el.spellBox) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (home.phase === 'listening') stopListeningQuietly();
        if (home.letters.length) check();
      }
    });
    el.spellInput.addEventListener('input', function () {
      home.letters = el.spellInput.value.toUpperCase().replace(/[^A-Z]/g, '').split('').filter(Boolean);
      el.spellInput.value = home.letters.join('');
      renderFront();
    });
    el.spellInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); finishTyping(); }
    });
    el.spellInput.addEventListener('blur', function () { setTimeout(finishTyping, 120); });

    el.back.addEventListener('click', next);
    el.back.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); }
    });
    el.finish.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'practise') practiseMissed();
      else if (act === 'again') startOver();
      else if (act === 'results') showTab('results');
    });

    var dlg = $('#dict-dialog');
    $('#dict-close').addEventListener('click', closeDict);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) closeDict(); });
  }

  /* =====================================================================
   * RESULTS - Dotty the ladybird
   * ===================================================================== */

  function renderResults() {
    var root = $('#results-root');
    var s = Store.stats();
    var L = Store.lists();
    var lvl = s.level;
    var mood = s.played === 0 ? 'wink' : (s.accuracy >= 60 ? 'happy' : 'idle');
    var msgKey = s.played === 0 ? 'res.msg.start'
      : s.left === 0 ? 'res.msg.done'
      : s.accuracy >= 80 ? 'res.msg.great'
      : s.accuracy >= 50 ? 'res.msg.good' : 'res.msg.keep';

    var levelText = lvl.last ? t('res.level.max')
      : t('res.level.next', { n: Math.max(1, lvl.nextAt - s.correct), name: t('level.' + (lvl.index + 1)) });

    var chips = function (items, bad) {
      return items.map(function (r) {
        return '<span class="word-chip ' + (bad ? 'miss' : 'ok') + '"><b>' + esc(r.word) + '</b>' +
          (bad ? '<small>' + esc(r.spelled.toUpperCase().split('').join('-')) + '</small>' : '') + '</span>';
      }).join('');
    };

    var cells = Store.honeycomb().map(function (c) {
      return '<span class="hex ' + c.state + '"' + (c.word ? ' title="' + esc(c.word) + '"' : '') + '></span>';
    }).join('');

    root.innerHTML =
      '<div class="hero">' + M.ladybird(mood, 'hero-lady') +
        '<div class="bubble bubble-left">' + esc(t(msgKey, { correct: s.correct, left: s.left })) + '</div></div>' +

      '<section class="panel level-card">' +
        '<div class="level-badge">' + M.icon('star') + '</div>' +
        '<div class="level-info">' +
          '<h2>' + esc(t('level.' + lvl.index)) + '</h2>' +
          '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(lvl.progress * 100) + '"><i style="width:' + Math.round(lvl.progress * 100) + '%"></i></div>' +
          '<p>' + esc(levelText) + '</p>' +
          (s.played ? '<p class="muted">' + esc(t('res.acc', { pct: s.accuracy })) + '</p>' : '') +
        '</div>' +
      '</section>' +

      '<div class="tiles">' +
        tile('honey', s.correct, 'res.tile.ok', 'res.tile.ok.sub') +
        tile('flower', s.left, 'res.tile.left', 'res.tile.left.sub') +
        tile('oops', s.missed, 'res.tile.miss', 'res.tile.miss.sub') +
        tile('fire', s.streak, 'res.tile.streak', null, t('res.tile.streak.sub', { n: s.best })) +
      '</div>' +

      '<section class="panel">' +
        '<h2>' + esc(t('res.comb.title')) + '</h2>' +
        '<div class="comb" id="comb">' + cells + '</div>' +
        '<ul class="legend"><li><i class="hex ok"></i>' + esc(t('res.legend.ok')) + '</li><li><i class="hex miss"></i>' + esc(t('res.legend.miss')) + '</li><li><i class="hex left"></i>' + esc(t('res.legend.left')) + '</li></ul>' +
      '</section>' +

      '<section class="panel">' +
        '<h3>' + esc(t('res.list.miss', { n: L.missed.length })) + '</h3>' +
        '<div class="chips">' + (L.missed.length ? chips(L.missed, true) : '<p class="muted">' + esc(t('res.list.empty.miss')) + '</p>') + '</div>' +
        '<h3>' + esc(t('res.list.ok', { n: L.correct.length })) + '</h3>' +
        '<div class="chips">' + (L.correct.length ? chips(L.correct, false) : '<p class="muted">' + esc(t('res.list.empty.ok')) + '</p>') + '</div>' +
      '</section>' +

      '<div class="actions">' +
        '<button class="btn" type="button" id="res-practise"' + (s.missed ? '' : ' disabled') + '>' + esc(t('res.practise', { n: s.missed })) + '</button>' +
        '<button class="btn ghost" type="button" id="res-restart">' + esc(t('res.restart')) + '</button>' +
      '</div>';

    $('#res-practise').addEventListener('click', practiseMissed);
    armConfirm($('#res-restart'), 'res.restart', 'res.restart.confirm', startOver);
    layoutComb();
  }

  function tile(icon, value, labelKey, subKey, subText) {
    return '<div class="tile-stat"><span class="ts-ico">' + M.icon(icon) + '</span>' +
      '<span class="ts-num">' + value + '</span>' +
      '<span class="ts-label">' + esc(t(labelKey)) + '</span>' +
      '<span class="ts-sub">' + esc(subKey ? t(subKey) : subText) + '</span></div>';
  }

  function layoutComb() {
    var c = $('#comb');
    if (!c || !c.clientWidth) return;
    var cells = $$('.hex', c);
    var w = 26, h = 30;
    var cols = Math.max(1, Math.floor((c.clientWidth - w / 2) / w));
    var used = Math.min(cols, cells.length || 1);
    var pad = Math.max(0, Math.floor((c.clientWidth - (used * w + w / 2)) / 2));
    cells.forEach(function (cell, i) {
      var r = Math.floor(i / cols), col = i % cols;
      cell.style.left = (pad + col * w + (r % 2 ? w / 2 : 0)) + 'px';
      cell.style.top = (r * h * 0.75) + 'px';
    });
    var rows = Math.ceil(cells.length / cols);
    c.style.height = rows ? ((rows - 1) * h * 0.75 + h) + 'px' : '0px';
  }

  /* =====================================================================
   * CONFIG - Dotty helps with the settings
   * ===================================================================== */

  var cfgFilter = '';

  function seg(name, options, current) {
    return '<div class="seg" role="group">' + options.map(function (o) {
      return '<button type="button" class="seg-btn" data-' + name + '="' + o[0] + '" aria-pressed="' + (current === o[0]) + '">' + esc(o[1]) + '</button>';
    }).join('') + '</div>';
  }

  function renderConfig() {
    var root = $('#config-root');
    var st = Store.get();
    var tip = t('cfg.tip.' + (1 + Math.floor(Math.random() * 3)));
    root.innerHTML =
      '<div class="hero">' + M.ladybird('wink', 'hero-lady') + '<div class="bubble bubble-left">' + esc(tip) + '</div></div>' +

      '<section class="panel"><h2>' + esc(t('cfg.lang.title')) + '</h2>' +
        seg('lang', [['es', 'Español'], ['en', 'English']], st.lang) + '</section>' +

      '<section class="panel"><h2>' + esc(t('cfg.voice.title')) + '</h2>' +
        '<p class="label">' + esc(t('cfg.accent')) + '</p>' +
        seg('accent', [['us', t('cfg.accent.us')], ['uk', t('cfg.accent.uk')]], st.accent) +
        '<label class="switch"><input type="checkbox" id="cfg-sfx" role="switch"' + (st.sfx ? ' checked' : '') + '><span class="track"><i></i></span><span>' + esc(t('cfg.sfx')) + '</span></label>' +
        '<p class="muted">' + esc(Voice.supportsRecognition ? t('cfg.voice.ok') : t('cfg.voice.no')) + '</p>' +
      '</section>' +

      '<section class="panel"><h2>' + esc(t('cfg.words.title')) + '</h2>' +
        '<p class="muted" id="cfg-summary"></p>' +
        '<div class="radio-row">' +
          '<label><input type="radio" name="upmode" value="replace" checked> ' + esc(t('cfg.upload.replace')) + '</label>' +
          '<label><input type="radio" name="upmode" value="add"> ' + esc(t('cfg.upload.add')) + '</label>' +
        '</div>' +
        '<div class="actions wrap">' +
          '<button class="btn" type="button" id="cfg-upload"><span class="btn-ico">' + M.icon('upload') + '</span>' + esc(t('cfg.upload')) + '</button>' +
          '<button class="btn alt" type="button" id="cfg-download"><span class="btn-ico">' + M.icon('download') + '</span>' + esc(t('cfg.download')) + '</button>' +
          '<button class="btn ghost" type="button" id="cfg-reset">' + esc(t('cfg.reset')) + '</button>' +
        '</div>' +
        '<input type="file" id="cfg-file" accept=".csv,.json,.txt,text/csv,application/json" hidden>' +
        '<details class="help"><summary>' + esc(t('cfg.help.title')) + '</summary>' +
          '<p>' + esc(t('cfg.help.body')) + '</p>' +
          '<pre>word,definition,partOfSpeech,example\nCamel,"A large animal with humps",noun,"The camel crossed the desert."\nMoon,,,</pre>' +
          '<pre>["Moon", "Camel", {"word": "Eagle", "definition": "A big bird of prey"}]</pre>' +
        '</details>' +
        '<form class="add-row" id="cfg-add"><input type="text" id="cfg-add-input" maxlength="40" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="' + esc(t('cfg.add.ph')) + '" aria-label="' + esc(t('cfg.add.ph')) + '">' +
          '<button class="btn small" type="submit"><span class="btn-ico">' + M.icon('plus') + '</span>' + esc(t('cfg.add.btn')) + '</button></form>' +
        '<input type="search" class="search" id="cfg-search" placeholder="' + esc(t('cfg.search.ph')) + '" aria-label="' + esc(t('cfg.search.ph')) + '" value="' + esc(cfgFilter) + '">' +
        '<ul class="word-list" id="cfg-list"></ul>' +
      '</section>';

    wireConfig();
    renderWordList();
  }

  function renderSummary() {
    var st = Store.get();
    var n = st.words.length;
    $('#cfg-summary').textContent = t('cfg.words.summary', { n: n, source: t(st.source === 'default' ? 'cfg.source.default' : 'cfg.source.custom') });
  }

  function renderWordList() {
    var list = $('#cfg-list');
    if (!list) return;
    var words = Store.words();
    list.innerHTML = words.map(function (w, i) {
      return '<li data-i="' + i + '"><input class="wl-input" type="text" value="' + esc(w.word) + '" maxlength="40" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="' + esc(t('cfg.word.aria', { n: i + 1 })) + '">' +
        '<button class="wl-del" type="button" aria-label="' + esc(t('cfg.remove')) + '" title="' + esc(t('cfg.remove')) + '">' + M.icon('close') + '</button></li>';
    }).join('') || '<li class="empty">' + esc(t('cfg.empty')) + '</li>';
    applyFilter();
    renderSummary();
  }

  function applyFilter() {
    var q = cfgFilter.trim().toLowerCase();
    $$('#cfg-list li[data-i]').forEach(function (li) {
      var v = $('.wl-input', li).value.toLowerCase();
      li.hidden = !!q && v.indexOf(q) < 0;
    });
  }

  function readText(file) {
    if (file.text) return file.text();
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result)); };
      r.onerror = reject;
      r.readAsText(file);
    });
  }

  function downloadList() {
    var words = Store.words();
    var plain = words.every(function (w) { return !w.definition && !w.partOfSpeech && !w.example; });
    var data = plain ? words.map(function (w) { return w.word; }) : words;
    var blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'word-list.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function wireConfig() {
    var root = $('#config-root');

    $$('[data-lang]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var l = b.getAttribute('data-lang');
        Store.set('lang', l);
        I.setLang(l);
        renderAll();
      });
    });
    $$('[data-accent]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        Store.set('accent', b.getAttribute('data-accent'));
        $$('[data-accent]', root).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        if (home.entry) Voice.prepare(home.entry, Store.get().accent);
      });
    });
    $('#cfg-sfx').addEventListener('change', function (e) {
      Store.set('sfx', e.target.checked);
      if (e.target.checked) Voice.sfx('pop');
    });

    var file = $('#cfg-file');
    $('#cfg-upload').addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      if (f.size > 2 * 1024 * 1024) { toast(t('cfg.upload.large')); file.value = ''; return; }
      readText(f).then(function (text) {
        var r = U.parseWordFile(text, f.name);
        var mode = ($('input[name=upmode]:checked', root) || {}).value || 'replace';
        if (mode === 'add') {
          var added = Store.addWords(r.entries);
          toast(t('cfg.upload.added', { n: added }));
        } else {
          Store.setWords(r.entries, 'upload');
          toast(t('cfg.upload.replaced', { n: r.entries.length }));
        }
        renderWordList();
      }).catch(function () { toast(t('cfg.upload.error'), 5200); });
      file.value = '';
    });

    $('#cfg-download').addEventListener('click', downloadList);
    armConfirm($('#cfg-reset'), 'cfg.reset', 'cfg.reset.confirm', function () {
      Store.resetToDefault();
      renderWordList();
      toast(t('cfg.reset.done'));
    });

    $('#cfg-add').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('#cfg-add-input');
      var entry = U.normalizeEntry(input.value);
      if (!entry) { input.focus(); return; }
      if (Store.words().some(function (w) { return key(w) === key(entry); })) { toast(t('cfg.add.dup')); return; }
      Store.addWords([entry]);
      input.value = '';
      cfgFilter = '';
      $('#cfg-search').value = '';
      renderWordList();
      var list = $('#cfg-list');
      list.scrollTop = list.scrollHeight;
    });

    $('#cfg-search').addEventListener('input', function (e) { cfgFilter = e.target.value; applyFilter(); });

    var list = $('#cfg-list');
    list.addEventListener('click', function (e) {
      var b = e.target.closest('.wl-del');
      if (!b) return;
      Store.removeWordAt(Number(b.closest('li').getAttribute('data-i')));
      renderWordList();
    });
    list.addEventListener('change', function (e) {
      var input = e.target;
      if (!input.classList.contains('wl-input')) return;
      var i = Number(input.closest('li').getAttribute('data-i'));
      var res = Store.renameWordAt(i, input.value);
      if (res === 'ok') {
        input.value = Store.words()[i].word;
        renderSummary();
        syncHome();
      } else {
        toast(t(res === 'duplicate' ? 'cfg.word.dup' : 'cfg.word.empty'));
        input.value = Store.words()[i].word;
      }
    });
  }

  /* =====================================================================
   * start-up
   * ===================================================================== */

  function renderAll() {
    applyStatic();
    renderFront();
    if (home.phase === 'back') renderBack();
    if (home.phase === 'finished') renderFinish();
    if (currentTab === 'results') renderResults();
    if (currentTab === 'config') renderConfig();
  }

  function loadDefaults() {
    return fetch('data/word-list-default.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (list) { return { list: list, fallback: false }; })
      .catch(function () { return { list: null, fallback: true }; });
  }

  function start(res) {
    Store.init(res.list, res.fallback);
    I.setLang(Store.get().lang);
    paintIcons();
    applyStatic();
    wireTabs();
    wireHome();
    Store.on(function () {
      syncHome();
      if (currentTab === 'results') renderResults();
    });
    window.addEventListener('resize', layoutComb);
    window.addEventListener('hashchange', function () { showTab((location.hash || '#home').slice(1)); });
    startRound();
    showTab((location.hash || '#home').slice(1));
    if (Store.get().usedFallback) toast(t('toast.fallback'), 7000);
  }

  loadDefaults().then(start);
})();
