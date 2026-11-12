/* SDGoku — хранение прогресса на устройстве, статистика, рекорды, достижения. */
(function (root) {
  'use strict';

  var KEY = 'sdgoku.v1';
  var BOARDS = ['easy', 'medium', 'hard', 'expert', 'daily'];
  var RULES = { maxMistakes: 3, maxHints: 3, hintPenalty: 30, topN: 10 };

  function blankBoard() { return { started: 0, won: 0, totalTime: 0, best: null, streak: 0, bestStreak: 0 }; }
  function defaults() {
    var boards = {}, records = {};
    BOARDS.forEach(function (b) { boards[b] = blankBoard(); records[b] = []; });
    return {
      v: 1,
      settings: { lang: null, sound: true, haptics: true, autoNotes: true, highlight: true, name: '' },
      game: null,
      boards: boards,
      goalsSolved: {},
      achievements: {},
      records: records,
      daily: { done: {}, streak: 0, bestStreak: 0, lastDate: null },
      updatedAt: 0
    };
  }
  function normalize(d) {
    var base = defaults();
    if (!d || typeof d !== 'object') return base;
    var k;
    for (k in base.settings) if (d.settings && d.settings[k] !== undefined) base.settings[k] = d.settings[k];
    BOARDS.forEach(function (b) {
      if (d.boards && d.boards[b]) for (var f in base.boards[b]) if (d.boards[b][f] !== undefined) base.boards[b][f] = d.boards[b][f];
      if (d.records && Array.isArray(d.records[b])) base.records[b] = d.records[b].slice(0, RULES.topN);
    });
    if (d.goalsSolved) base.goalsSolved = d.goalsSolved;
    if (d.achievements) base.achievements = d.achievements;
    if (d.daily) {
      base.daily.done = d.daily.done || {};
      base.daily.streak = d.daily.streak || 0;
      base.daily.bestStreak = d.daily.bestStreak || 0;
      base.daily.lastDate = d.daily.lastDate || null;
    }
    if (d.game && Array.isArray(d.game.cells) && d.game.cells.length === 81) base.game = d.game;
    base.updatedAt = d.updatedAt || 0;
    return base;
  }

  // localStorage может быть недоступен — тогда работаем в памяти.
  var memory = null;
  function read() {
    try { var raw = root.localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; }
    catch (e) { return memory; }
  }
  function write(d) {
    memory = d;
    try { root.localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* остаёмся в памяти */ }
  }

  var data = normalize(read());

  // ---- даты ----
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dateKey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function prevDateKey(key) {
    var p = key.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setDate(d.getDate() - 1);
    return dateKey(d);
  }
  function dailyStreakNow() {
    var t = dateKey(), last = data.daily.lastDate;
    return (last === t || last === prevDateKey(t)) ? data.daily.streak : 0;
  }

  // ---- достижения ----
  function totalWon(d) { return BOARDS.reduce(function (s, b) { return s + d.boards[b].won; }, 0); }
  function goalsCollected(d) { var n = 0; for (var g = 1; g <= 17; g++) if (d.goalsSolved[g] > 0) n++; return n; }
  var ACHIEVEMENTS = [
    { id: 'first_win', test: function (d) { return totalWon(d) >= 1; } },
    { id: 'win_easy', test: function (d) { return d.boards.easy.won >= 1; } },
    { id: 'win_medium', test: function (d) { return d.boards.medium.won >= 1; } },
    { id: 'win_hard', test: function (d) { return d.boards.hard.won >= 1; } },
    { id: 'win_expert', test: function (d) { return d.boards.expert.won >= 1; } },
    { id: 'flawless', test: function (d, r) { return !!r && r.mistakes === 0; } },
    { id: 'no_hints', test: function (d, r) { return !!r && r.hints === 0 && r.diff !== 'easy'; } },
    { id: 'speed', test: function (d, r) { return !!r && r.seconds < 300; } },
    { id: 'wins_10', test: function (d) { return totalWon(d) >= 10; } },
    { id: 'wins_50', test: function (d) { return totalWon(d) >= 50; } },
    { id: 'daily_3', test: function (d) { return d.daily.bestStreak >= 3; } },
    { id: 'daily_7', test: function (d) { return d.daily.bestStreak >= 7; } },
    { id: 'all_goals', test: function (d) { return goalsCollected(d) >= 17; } }
  ];
  function evalAchievements(result) {
    var fresh = [];
    ACHIEVEMENTS.forEach(function (a) {
      if (!data.achievements[a.id] && a.test(data, result)) {
        data.achievements[a.id] = Date.now();
        fresh.push(a.id);
      }
    });
    return fresh;
  }

  // ---- запись результатов ----
  function touch() { data.updatedAt = Date.now(); write(data); }
  function save() { write(data); }

  function recordStart(board) { data.boards[board].started++; touch(); }
  function recordLoss(board) { data.boards[board].streak = 0; touch(); }

  /* result: { board, diff, seconds, mistakes, hints, goals:[9], dateKey? } */
  function recordWin(result) {
    var b = data.boards[result.board];
    var score = result.seconds + result.hints * RULES.hintPenalty;
    b.won++;
    b.totalTime += result.seconds;
    var isRecord = b.best === null || score < b.best;
    if (isRecord) b.best = score;
    b.streak++;
    if (b.streak > b.bestStreak) b.bestStreak = b.streak;
    (result.goals || []).forEach(function (g) { data.goalsSolved[g] = (data.goalsSolved[g] || 0) + 1; });

    var entry = { score: score, seconds: result.seconds, hints: result.hints, mistakes: result.mistakes, ts: Date.now() };
    if (result.dateKey) entry.dateKey = result.dateKey;
    var list = data.records[result.board];
    list.push(entry);
    list.sort(function (x, y) { return x.score - y.score || x.ts - y.ts; });
    if (list.length > RULES.topN) list.length = RULES.topN;

    if (result.board === 'daily' && result.dateKey && !data.daily.done[result.dateKey]) {
      data.daily.done[result.dateKey] = { score: score, seconds: result.seconds };
      data.daily.streak = data.daily.lastDate === prevDateKey(result.dateKey) ? data.daily.streak + 1 : 1;
      data.daily.lastDate = result.dateKey;
      if (data.daily.streak > data.daily.bestStreak) data.daily.bestStreak = data.daily.streak;
    }
    var fresh = evalAchievements(result);
    touch();
    return { score: score, isRecord: isRecord, achievements: fresh, entry: entry };
  }

  function resetProgress() {
    var keep = data.settings;
    data = normalize(null);
    data.settings = keep;
    api.data = data;
    touch();
  }

  // ---- синхронизация с сервером: что отдаём и как объединяем ----
  function exportProgress() {
    return {
      v: 1, name: data.settings.name || '',
      boards: data.boards, goalsSolved: data.goalsSolved, achievements: data.achievements,
      records: data.records, daily: data.daily, updatedAt: data.updatedAt
    };
  }
  function mergeProgress(remote) {
    if (!remote || typeof remote !== 'object') return false;
    var r = normalize(remote);
    BOARDS.forEach(function (b) {
      var L = data.boards[b], R = r.boards[b];
      L.started = Math.max(L.started, R.started);
      L.won = Math.max(L.won, R.won);
      L.totalTime = Math.max(L.totalTime, R.totalTime);
      L.bestStreak = Math.max(L.bestStreak, R.bestStreak);
      L.streak = Math.max(L.streak, R.streak);
      if (R.best !== null && (L.best === null || R.best < L.best)) L.best = R.best;
      var seen = {}, all = [];
      data.records[b].concat(r.records[b]).forEach(function (e) {
        var key = e.ts + ':' + e.score;
        if (!seen[key]) { seen[key] = 1; all.push(e); }
      });
      all.sort(function (x, y) { return x.score - y.score || x.ts - y.ts; });
      data.records[b] = all.slice(0, RULES.topN);
    });
    for (var g = 1; g <= 17; g++) {
      var m = Math.max(data.goalsSolved[g] || 0, r.goalsSolved[g] || 0);
      if (m) data.goalsSolved[g] = m;
    }
    for (var id in r.achievements) {
      if (!data.achievements[id] || r.achievements[id] < data.achievements[id]) data.achievements[id] = r.achievements[id];
    }
    for (var day in r.daily.done) if (!data.daily.done[day]) data.daily.done[day] = r.daily.done[day];
    if ((r.daily.lastDate || '') > (data.daily.lastDate || '')) {
      data.daily.lastDate = r.daily.lastDate;
      data.daily.streak = r.daily.streak;
    } else if (r.daily.lastDate === data.daily.lastDate) {
      data.daily.streak = Math.max(data.daily.streak, r.daily.streak);
    }
    data.daily.bestStreak = Math.max(data.daily.bestStreak, r.daily.bestStreak);
    if (!data.settings.name && remote.name) data.settings.name = String(remote.name).slice(0, 20);
    evalAchievements(null);
    touch();
    return true;
  }

  var api = {
    BOARDS: BOARDS, RULES: RULES, ACHIEVEMENTS: ACHIEVEMENTS,
    data: data, save: save, touch: touch,
    dateKey: dateKey, prevDateKey: prevDateKey, dailyStreakNow: dailyStreakNow,
    totalWon: function () { return totalWon(data); },
    totalStarted: function () { return BOARDS.reduce(function (s, b) { return s + data.boards[b].started; }, 0); },
    goalsCollected: function () { return goalsCollected(data); },
    recordStart: recordStart, recordLoss: recordLoss, recordWin: recordWin,
    resetProgress: resetProgress, exportProgress: exportProgress, mergeProgress: mergeProgress
  };
  root.SDGokuStore = api;
})(window);
