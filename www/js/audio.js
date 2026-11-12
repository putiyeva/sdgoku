/* SDGoku — звуки (синтез через Web Audio, без файлов) и вибрация. */
(function (root) {
  'use strict';
  var ctx = null;
  function ensure() {
    if (ctx) return ctx;
    try {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (AC) ctx = new AC();
    } catch (e) { ctx = null; }
    return ctx;
  }
  function tone(freq, start, dur, type, gain) {
    var c = ensure();
    if (!c) return;
    try {
      var o = c.createOscillator(), g = c.createGain();
      var t0 = c.currentTime + start;
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain || 0.12, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* звук не обязателен */ }
  }
  var SOUNDS = {
    tap: function () { tone(520, 0, 0.05, 'triangle', 0.05); },
    place: function () { tone(660, 0, 0.09, 'triangle', 0.11); tone(990, 0.05, 0.1, 'sine', 0.07); },
    note: function () { tone(880, 0, 0.05, 'sine', 0.05); },
    erase: function () { tone(330, 0, 0.08, 'triangle', 0.07); },
    error: function () { tone(196, 0, 0.16, 'sawtooth', 0.09); tone(147, 0.09, 0.2, 'sawtooth', 0.08); },
    hint: function () { tone(784, 0, 0.1, 'sine', 0.09); tone(1175, 0.08, 0.16, 'sine', 0.08); },
    unit: function () { tone(659, 0, 0.09, 'triangle', 0.09); tone(784, 0.07, 0.09, 'triangle', 0.09); tone(988, 0.14, 0.14, 'triangle', 0.09); },
    win: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, i * 0.11, 0.26, 'triangle', 0.11); }); },
    over: function () { [392, 330, 262].forEach(function (f, i) { tone(f, i * 0.16, 0.3, 'triangle', 0.1); }); }
  };
  root.SDGokuSfx = {
    play: function (name, enabled) {
      if (!enabled || !SOUNDS[name]) return;
      var c = ensure();
      if (c && c.state === 'suspended' && c.resume) { try { c.resume(); } catch (e) { /* ignore */ } }
      SOUNDS[name]();
    },
    buzz: function (pattern, enabled) {
      if (!enabled) return;
      try { if (root.navigator && root.navigator.vibrate) root.navigator.vibrate(pattern); } catch (e) { /* ignore */ }
    }
  };
})(window);
