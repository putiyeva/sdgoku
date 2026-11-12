/* SDGoku — интерфейс и игровая логика. */
(function () {
  'use strict';

  var E = window.SDGokuEngine, Store = window.SDGokuStore, Sfx = window.SDGokuSfx,
      Cloud = window.SDGokuCloud, I18N = window.SDGOKU_I18N;
  var CONFIG = window.SDGOKU_CONFIG || {};
  var LANGS = ['ru', 'en', 'az'];
  var DIFFS = ['easy', 'medium', 'hard', 'expert'];
  var RULES = Store.RULES;
  var UN_URL = 'https://www.un.org/sustainabledevelopment/';

  var $screen = document.getElementById('screen');
  var $tabs = document.getElementById('tabs');
  var $modal = document.getElementById('modal');
  var $toasts = document.getElementById('toasts');

  var ui = {
    tab: 'home', inGame: false, sel: -1, focus: 0, notes: false, paused: false, fx: {},
    recBoard: 'easy', recView: 'mine', global: { key: '', state: 'idle', rows: [] },
    modal: null, authMode: 'in'
  };
  var cellEls = [];
  var dailyPreview = null;

  function S() { return Store.data; }
  function G() { return Store.data.game; }

  // ------------------------------------------------------------ язык и формат
  function detectLang() {
    var n = String((navigator.languages && navigator.languages[0]) || navigator.language || 'en').toLowerCase();
    if (n.indexOf('ru') === 0) return 'ru';
    if (n.indexOf('az') === 0) return 'az';
    return 'en';
  }
  function L() { return I18N[S().settings.lang] || I18N.en; }
  function t(key, vars) {
    var s = L()[key];
    if (s === undefined) s = I18N.en[key];
    if (s === undefined) return key;
    if (vars) for (var k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }
  function goalText(id) { return L().goals[id] || I18N.en.goals[id]; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ':' + pad2(m) : pad2(m)) + ':' + pad2(s);
  }
  function fmtDay(d) {
    var l = L();
    return l.day_pattern.replace('{weekday}', l.weekdays[d.getDay()]).replace('{day}', d.getDate()).replace('{month}', l.months[d.getMonth()]);
  }
  function fmtShortDate(d) { return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.' + d.getFullYear(); }
  function boardName(b) { return t('diff_' + b); }

  var ICONS = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    goals: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    stats: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    records: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 20h8"/>',
    settings: '<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.5"/><circle cx="8" cy="17" r="2.5"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    play: '<path d="M8 5l11 7-11 7z"/>',
    undo: '<path d="M9 6L4 11l5 5"/><path d="M4 11h10a5 5 0 0 1 0 10h-3"/>',
    erase: '<path d="M4 16l9-9 6 6-7 7H8z"/><path d="M13 20h7"/>',
    notes: '<path d="M4 20l1-5L16 4l4 4L9 19z"/><path d="M14 6l4 4"/>',
    hint: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>'
  };
  function icon(name) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>'; }

  function sfx(name) { Sfx.play(name, S().settings.sound); }
  function buzz(p) { Sfx.buzz(p, S().settings.haptics); }

  // ------------------------------------------------------------ всплывающие сообщения и окна
  function toast(text) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    $toasts.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, 2600);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3100);
  }
  function openModal(body, actions, opts) {
    ui.modal = opts || {};
    $modal.innerHTML = '<div class="backdrop" data-act="backdrop"></div>' +
      '<div class="sheet' + (ui.modal.cls ? ' ' + ui.modal.cls : '') + '" role="dialog" aria-modal="true">' +
      '<div class="sheet-body">' + body + '</div>' +
      (actions ? '<div class="sheet-actions actions">' + actions + '</div>' : '') + '</div>';
    $modal.hidden = false;
    var first = $modal.querySelector('[data-autofocus]') || $modal.querySelector('button, input');
    if (first) { try { first.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }
  function closeModal() {
    var m = ui.modal;
    ui.modal = null;
    $modal.hidden = true;
    $modal.innerHTML = '';
    if (m && m.onClose) m.onClose();
  }
  function confirmBox(text, yesLabel, onYes, danger) {
    ui.confirmYes = onYes;
    openModal('<p class="confirm-text">' + esc(text) + '</p>',
      '<button class="btn' + (danger ? ' danger' : ' primary') + '" data-act="confirm-yes" data-autofocus>' + esc(yesLabel) + '</button>' +
      '<button class="btn" data-act="modal-close">' + esc(t('cancel')) + '</button>', { dismissable: true });
  }

  // ------------------------------------------------------------ вкладки
  function render() {
    document.documentElement.lang = S().settings.lang;
    if (ui.inGame && G()) { renderGame(); return; }
    ui.inGame = false;
    document.body.classList.remove('in-game');
    var views = { home: viewHome, goals: viewGoals, stats: viewStats, records: viewRecords, settings: viewSettings };
    var keepScroll = ui.lastView === ui.tab ? $screen.scrollTop : 0;
    $screen.innerHTML = '<div class="view view-' + ui.tab + '">' + views[ui.tab]() + '</div>';
    $screen.scrollTop = keepScroll;
    ui.lastView = ui.tab;
    $tabs.hidden = false;
    $tabs.innerHTML = ['home', 'goals', 'stats', 'records', 'settings'].map(function (id) {
      return '<button class="tab' + (ui.tab === id ? ' on' : '') + '" data-act="tab" data-tab="' + id + '"' +
        (ui.tab === id ? ' aria-current="page"' : '') + '>' + icon(id) + '<span>' + esc(t('tab_' + id)) + '</span></button>';
    }).join('');
    if (ui.tab === 'records' && ui.recView === 'global') loadGlobal();
  }

  function getDailyPreview() {
    var key = Store.dateKey();
    if (!dailyPreview || dailyPreview.key !== key) {
      var seed = E.dailySeed(key);
      var p = E.generate('medium', seed);
      dailyPreview = { key: key, puzzle: p.puzzle, solution: p.solution, goals: E.pickGoals(seed), seed: seed };
    }
    return dailyPreview;
  }
  function filledPercent(g) {
    var total = 0, done = 0;
    for (var i = 0; i < 81; i++) {
      if (!g.puzzle[i]) { total++; if (g.cells[i] === g.solution[i]) done++; }
    }
    return total ? Math.round(done * 100 / total) : 100;
  }

  function viewHome() {
    var g = G(), today = Store.dateKey(), dp = getDailyPreview();
    var done = S().daily.done[today];
    var html = '<header class="brand"><h1 class="wordmark">SDG<span>oku</span></h1>' +
      '<p class="tagline">' + esc(t('tagline')) + '</p></header>';

    if (g && g.status === 'playing') {
      html += '<button class="card continue" data-act="continue"><span class="continue-main">' +
        '<strong>' + esc(t('continue_game')) + '</strong>' +
        '<span class="muted">' + esc(boardName(g.board)) + ' · ' + fmtTime(g.seconds) + ' · ' + esc(t('filled', { n: filledPercent(g) })) + '</span>' +
        '</span>' + icon('play') + '</button>';
    }

    var mini = '';
    for (var i = 0; i < 81; i++) {
      var v = dp.puzzle[i];
      mini += '<i' + (v ? ' class="g' + dp.goals[v - 1] + '"' : '') + '></i>';
    }
    var streak = Store.dailyStreakNow();
    html += '<section class="card daily"><div class="daily-text">' +
      '<p class="eyebrow">' + esc(fmtDay(new Date())) + '</p>' +
      '<h2>' + esc(t('daily_title')) + '</h2>' +
      (done
        ? '<p class="done-line">' + icon('check') + '<span>' + esc(t('daily_done', { time: fmtTime(done.score) })) + '</span></p>'
        : '<p class="muted">' + esc(t('daily_hint')) + '</p>') +
      (streak > 0 ? '<p class="streak">' + esc(t('daily_streak', { n: streak })) + '</p>' : '') +
      (done ? '' : '<button class="btn primary" data-act="daily">' + esc(t('play')) + '</button>') +
      '</div><div class="mini" aria-hidden="true">' + mini + '</div></section>';

    html += '<section><h2>' + esc(t('new_game')) + '</h2><div class="levels">' + DIFFS.map(function (d, idx) {
      var bars = '';
      for (var b = 0; b < 4; b++) bars += '<i' + (b <= idx ? ' class="on"' : '') + '></i>';
      return '<button class="level" data-act="new" data-diff="' + d + '">' +
        '<span class="bars" aria-hidden="true">' + bars + '</span>' +
        '<strong>' + esc(t('diff_' + d)) + '</strong>' +
        '<span class="muted">' + esc(t('open_cells', { n: E.TARGET_CLUES[d] })) + '</span></button>';
    }).join('') + '</div></section>';

    html += '<section class="how"><h2>' + esc(t('how_title')) + '</h2><ol>' +
      [1, 2, 3, 4].map(function (n) { return '<li>' + esc(t('how_' + n)) + '</li>'; }).join('') + '</ol></section>';
    return html;
  }

  function viewGoals() {
    var n = Store.goalsCollected();
    var html = '<h1>' + esc(t('goals_title')) + '</h1><p class="lead">' + esc(t('goals_intro')) + '</p>' +
      '<div class="progress" role="img" aria-label="' + esc(t('goals_progress', { n: n })) + '"><div style="width:' + (n / 17 * 100).toFixed(1) + '%"></div></div>' +
      '<p class="muted small">' + esc(t('goals_progress', { n: n })) + '</p><div class="goalgrid">';
    for (var id = 1; id <= 17; id++) {
      var c = S().goalsSolved[id] || 0;
      html += '<button class="goalbtn" data-act="goal" data-goal="' + id + '" aria-label="' + esc(t('caption_goal', { n: id, name: goalText(id).name })) + '">' +
        '<span class="tile g' + id + '"></span>' + (c ? '<span class="badge">' + icon('check') + '</span>' : '') + '</button>';
    }
    return html + '</div>';
  }
  function goalCard(id) {
    var gt = goalText(id), c = S().goalsSolved[id] || 0;
    return '<div class="fact"><span class="tile big g' + id + '"></span><div class="fact-text">' +
      '<h3>' + esc(t('caption_goal', { n: id, name: gt.name })) + '</h3>' +
      '<p>' + esc(gt.about) + '</p>' +
      '<p class="task"><span class="eyebrow">' + esc(t('goal_task')) + '</span>' + esc(gt.task) + '</p>' +
      '<p class="muted small">' + esc(t('goal_solved', { n: c })) + '</p></div></div>';
  }
  function showGoal(id) {
    openModal(goalCard(id),
      '<a class="btn" href="' + UN_URL + '" target="_blank" rel="noopener">' + esc(t('learn_more')) + '</a>' +
      '<button class="btn primary" data-act="modal-close" data-autofocus>' + esc(t('close')) + '</button>', { dismissable: true });
  }

  function viewStats() {
    var d = S(), played = Store.totalStarted(), won = Store.totalWon();
    var bestStreak = Store.BOARDS.reduce(function (m, b) { return Math.max(m, d.boards[b].bestStreak); }, 0);
    function tile(label, value) { return '<div class="stat"><span class="num">' + value + '</span><span class="lbl">' + esc(label) + '</span></div>'; }
    var html = '<h1>' + esc(t('stats_title')) + '</h1><div class="statgrid">' +
      tile(t('st_played'), played) + tile(t('st_won'), won) + tile(t('st_rate'), played ? Math.round(won * 100 / played) : 0) +
      tile(t('st_best_streak'), bestStreak) + tile(t('st_daily_streak'), Store.dailyStreakNow()) +
      tile(t('goals_title'), Store.goalsCollected() + '/17') + '</div>';

    html += '<h2>' + esc(t('st_by_level')) + '</h2><div class="tablewrap"><table class="table"><thead><tr><th>' + esc(t('st_level')) + '</th><th>' +
      esc(t('st_won_of')) + '</th><th>' + esc(t('st_best')) + '</th><th>' + esc(t('st_avg')) + '</th></tr></thead><tbody>';
    Store.BOARDS.forEach(function (b) {
      var s = d.boards[b];
      html += '<tr><th>' + esc(boardName(b)) + '</th><td>' + s.won + ' / ' + s.started + '</td><td>' +
        (s.best !== null ? fmtTime(s.best) : '–') + '</td><td>' + (s.won ? fmtTime(s.totalTime / s.won) : '–') + '</td></tr>';
    });
    html += '</tbody></table></div>';

    var got = Store.ACHIEVEMENTS.filter(function (a) { return d.achievements[a.id]; }).length;
    html += '<h2>' + esc(t('ach_title')) + ' <span class="count">' + esc(t('ach_progress', { n: got, total: Store.ACHIEVEMENTS.length })) + '</span></h2><ul class="achs">';
    Store.ACHIEVEMENTS.forEach(function (a) {
      var has = !!d.achievements[a.id];
      html += '<li class="ach' + (has ? ' got' : '') + '"><span class="ach-ic">' + icon(has ? 'check' : 'lock') + '</span>' +
        '<span class="ach-text"><strong>' + esc(t('ach_' + a.id)) + '</strong><span class="muted">' + esc(t('ach_' + a.id + '_d')) + '</span></span></li>';
    });
    return html + '</ul>';
  }

  function globalBoardId(b) { return b === 'daily' ? 'daily-' + Store.dateKey() : b; }
  function loadGlobal() {
    if (!Cloud.state.available || !Cloud.state.ready) return;
    var key = globalBoardId(ui.recBoard);
    if (ui.global.key === key && ui.global.state !== 'idle') return;
    ui.global = { key: key, state: 'loading', rows: [] };
    Cloud.fetchTop(key, 50).then(function (rows) {
      if (ui.global.key !== key) return;
      ui.global = { key: key, state: 'ok', rows: rows };
      if (ui.tab === 'records' && !ui.inGame) paintRecordsList();
    }).catch(function () {
      if (ui.global.key !== key) return;
      ui.global = { key: key, state: 'error', rows: [] };
      if (ui.tab === 'records' && !ui.inGame) paintRecordsList();
    });
  }
  function recordsListHtml() {
    var html = '';
    if (ui.recView === 'mine') {
      var list = S().records[ui.recBoard];
      if (!list.length) return '<p class="empty">' + esc(t('rec_empty')) + '</p>';
      html = '<ol class="ranks">';
      list.forEach(function (e, i) {
        html += '<li><span class="place">' + (i + 1) + '</span><span class="who">' + esc(fmtShortDate(new Date(e.ts))) +
          (e.hints ? '<span class="muted small">' + esc(t('rec_hints', { n: e.hints })) + '</span>' : '') + '</span>' +
          '<span class="res">' + fmtTime(e.score) + '</span></li>';
      });
      return html + '</ol>';
    }
    if (!Cloud.state.available) return '<p class="notice">' + esc(t('rec_cloud_off')) + '</p>';
    if (ui.global.state === 'loading' || ui.global.state === 'idle') return '<p class="empty">' + esc(t('rec_loading')) + '</p>';
    if (ui.global.state === 'error') return '<p class="notice">' + esc(t('rec_error')) + '</p>';
    var me = Cloud.state.user ? Cloud.state.user.uid : null;
    if (!me) html += '<p class="notice">' + esc(t('rec_signin')) + '</p>';
    if (!ui.global.rows.length) return html + '<p class="empty">' + esc(t('rec_empty')) + '</p>';
    html += '<ol class="ranks">';
    ui.global.rows.forEach(function (r, i) {
      html += '<li' + (r.uid === me ? ' class="me"' : '') + '><span class="place">' + (i + 1) + '</span><span class="who">' +
        esc(r.name || t('rec_player')) + (r.uid === me ? ' <span class="muted small">(' + esc(t('rec_you')) + ')</span>' : '') + '</span>' +
        '<span class="res">' + fmtTime(r.score) + '</span></li>';
    });
    return html + '</ol>';
  }
  function paintRecordsList() {
    var el = document.getElementById('recList');
    if (el) el.innerHTML = recordsListHtml();
  }
  function viewRecords() {
    var html = '<h1>' + esc(t('rec_title')) + '</h1><div class="seg" role="tablist">' + Store.BOARDS.map(function (b) {
      return '<button role="tab" aria-selected="' + (ui.recBoard === b) + '" class="' + (ui.recBoard === b ? 'on' : '') + '" data-act="rec-board" data-board="' + b + '">' +
        esc(b === 'daily' ? t('daily_short') : boardName(b)) + '</button>';
    }).join('') + '</div><div class="seg two" role="tablist">' + ['mine', 'global'].map(function (v) {
      return '<button role="tab" aria-selected="' + (ui.recView === v) + '" class="' + (ui.recView === v ? 'on' : '') + '" data-act="rec-view" data-view="' + v + '">' + esc(t('rec_' + v)) + '</button>';
    }).join('') + '</div><div id="recList">' + recordsListHtml() + '</div><p class="muted small">' + esc(t('score_note')) + '</p>';
    return html;
  }

  function viewSettings() {
    var s = S().settings, cs = Cloud.state;
    function sw(key, label, desc) {
      return '<div class="row"><span class="row-text"><span id="lbl-' + key + '">' + esc(label) + '</span>' + (desc ? '<span class="muted small">' + esc(desc) + '</span>' : '') + '</span>' +
        '<button class="switch" role="switch" aria-checked="' + (!!s[key]) + '" aria-labelledby="lbl-' + key + '" data-act="toggle" data-key="' + key + '"><i></i></button></div>';
    }
    var html = '<h1>' + esc(t('set_title')) + '</h1><section class="card group"><div class="row"><span class="row-text">' + esc(t('set_lang')) + '</span>' +
      '<div class="seg inline">' + LANGS.map(function (l) {
        return '<button class="' + (s.lang === l ? 'on' : '') + '" aria-pressed="' + (s.lang === l) + '" data-act="lang" data-lang="' + l + '" lang="' + l + '">' + esc(I18N[l].lang_name) + '</button>';
      }).join('') + '</div></div>' +
      sw('sound', t('set_sound')) + sw('haptics', t('set_haptics')) +
      sw('autoNotes', t('set_autonotes'), t('set_autonotes_d')) + sw('highlight', t('set_highlight'), t('set_highlight_d')) +
      '<div class="row"><label class="row-text" for="playerName">' + esc(t('set_name')) + '</label>' +
      '<input id="playerName" class="input short" type="text" maxlength="20" autocomplete="nickname" placeholder="' + esc(t('set_name_ph')) + '" value="' + esc(s.name || '') + '"></div></section>';

    html += '<h2>' + esc(t('acc_title')) + '</h2><section class="card group">';
    if (!cs.available) {
      html += '<p class="notice plain">' + esc(t('acc_off')) + '</p>';
    } else if (cs.user) {
      html += '<p>' + esc(t('acc_signed', { email: cs.user.email })) + '</p><p class="muted small">' +
        esc(cs.syncing ? t('acc_syncing') : cs.syncError ? t('acc_sync_err') : t('acc_synced')) + '</p>' +
        '<div class="actions"><button class="btn" data-act="signout">' + esc(t('acc_signout')) + '</button>' +
        '<button class="btn danger ghost" data-act="delete-account">' + esc(t('acc_delete')) + '</button></div>';
    } else {
      html += '<p class="muted">' + esc(t('acc_hint')) + '</p><div class="actions"><button class="btn primary" data-act="auth">' + esc(t('acc_signin')) + '</button></div>';
    }
    html += '</section><section class="card group"><div class="actions"><button class="btn danger ghost" data-act="reset">' + esc(t('reset')) + '</button></div></section>';

    html += '<h2>' + esc(t('about_title')) + '</h2><section class="about"><p>' + esc(t('about_text')) + '</p>' +
      '<p><a href="' + UN_URL + '" target="_blank" rel="noopener">' + esc(t('about_link')) + '</a><br><span class="muted small">un.org/sustainabledevelopment</span></p>' +
      '<p class="muted small">' + esc(t('version', { v: CONFIG.version || '0' })) + '</p></section>';
    return html;
  }

  // ------------------------------------------------------------ аккаунт
  function showAuth(message) {
    var up = ui.authMode === 'up';
    openModal('<form id="authForm" novalidate><h2>' + esc(t(up ? 'auth_up_title' : 'auth_in_title')) + '</h2>' +
      '<label class="field" for="authEmail">' + esc(t('email')) + '</label>' +
      '<input class="input" id="authEmail" type="email" inputmode="email" autocomplete="email" autocapitalize="none" required data-autofocus>' +
      '<label class="field" for="authPass">' + esc(t('password')) + '</label>' +
      '<input class="input" id="authPass" type="password" autocomplete="' + (up ? 'new-password' : 'current-password') + '" minlength="6" required>' +
      '<p class="formmsg" id="authMsg" role="alert">' + esc(message || '') + '</p>' +
      '<div class="actions"><button class="btn primary" type="submit">' + esc(t(up ? 'auth_up' : 'auth_in')) + '</button>' +
      '<button class="btn" type="button" data-act="modal-close">' + esc(t('cancel')) + '</button></div>' +
      '<p class="links"><button type="button" class="link" data-act="auth-switch">' + esc(t(up ? 'auth_to_in' : 'auth_to_up')) + '</button>' +
      (up ? '' : '<button type="button" class="link" data-act="auth-forgot">' + esc(t('auth_forgot')) + '</button>') + '</p></form>', '', { dismissable: true });
  }
  function authMsg(text) { var el = document.getElementById('authMsg'); if (el) el.textContent = text; }
  function authValues() {
    var e = document.getElementById('authEmail'), p = document.getElementById('authPass');
    return { email: e ? e.value.trim() : '', password: p ? p.value : '' };
  }
  function submitAuth() {
    var v = authValues();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) { authMsg(t('err_email')); return; }
    if (v.password.length < 6) { authMsg(t('err_password')); return; }
    authMsg('…');
    var call = ui.authMode === 'up' ? Cloud.signUp(v.email, v.password) : Cloud.signIn(v.email, v.password);
    call.then(function (res) {
      if (res.ok) { closeModal(); } else { authMsg(t(res.error)); }
    });
  }
  function forgotPassword() {
    var v = authValues();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) { authMsg(t('err_email')); return; }
    Cloud.resetPassword(v.email).then(function (res) {
      authMsg(res.ok ? t('auth_reset_sent', { email: v.email }) : t(res.error));
    });
  }

  // ------------------------------------------------------------ игра: запуск
  function requestGame(mode, diff) {
    var g = G();
    if (mode === 'daily') {
      var today = Store.dateKey();
      if (S().daily.done[today]) return;
      if (g && g.status === 'playing' && g.board === 'daily' && g.dateKey === today) { enterGame(); return; }
    }
    if (g && g.status === 'playing' && g.seconds > 10) {
      confirmBox(t('replace_q'), t('replace_yes'), function () { beginGame(mode, diff); });
    } else {
      beginGame(mode, diff);
    }
  }
  function beginGame(mode, diff) {
    var seed, p, goals, dateKey = null;
    if (mode === 'daily') {
      var dp = getDailyPreview();
      seed = dp.seed; p = dp; goals = dp.goals; dateKey = dp.key; diff = 'medium';
    } else {
      seed = Math.floor(Math.random() * 4294967296) >>> 0;
      p = E.generate(diff, seed);
      goals = E.pickGoals(seed);
    }
    var board = mode === 'daily' ? 'daily' : diff;
    var notes = [];
    for (var i = 0; i < 81; i++) notes.push(0);
    S().game = {
      v: 1, mode: mode, board: board, diff: diff, dateKey: dateKey, seed: seed, goals: goals.slice(),
      puzzle: p.puzzle.slice(), solution: p.solution.slice(), cells: p.puzzle.slice(), notes: notes,
      mistakes: 0, hints: 0, seconds: 0, history: [], status: 'playing'
    };
    Store.recordStart(board);
    enterGame();
  }
  function enterGame() {
    ui.inGame = true; ui.sel = -1; ui.focus = 0; ui.notes = false; ui.paused = false; ui.fx = {};
    render();
  }
  function leaveGame() {
    ui.inGame = false;
    Store.save();
    ui.tab = 'home';
    render();
  }

  // ------------------------------------------------------------ игра: экран
  function renderGame() {
    var g = G();
    document.body.classList.add('in-game');
    $tabs.hidden = true;
    var html = '<div class="game"><div class="gtop">' +
      '<button class="iconbtn" data-act="leave" aria-label="' + esc(t('back')) + '">' + icon('back') + '</button>' +
      '<div class="gmeta"><strong>' + esc(boardName(g.board)) + '</strong><span id="gMist"></span></div>' +
      '<div class="gtime"><span id="gTimer" aria-label="' + esc(t('timer')) + '">' + fmtTime(g.seconds) + '</span>' +
      '<button class="iconbtn" id="pauseBtn" data-act="pause" aria-label="' + esc(t('pause')) + '">' + icon('pause') + '</button></div></div>' +
      '<div class="boardwrap" id="boardWrap"><div class="board" id="board" role="grid" aria-label="Sudoku">';
    for (var b = 0; b < 9; b++) {
      html += '<div class="box" role="presentation">';
      for (var k = 0; k < 9; k++) {
        var r = Math.floor(b / 3) * 3 + Math.floor(k / 3), c = (b % 3) * 3 + (k % 3), i = r * 9 + c;
        html += '<button class="cell" role="gridcell" data-act="cell" data-i="' + i + '"></button>';
      }
      html += '</div>';
    }
    html += '</div><div class="pausecover" id="pauseCover" hidden><p>' + esc(t('paused')) + '</p>' +
      '<button class="btn primary" data-act="pause">' + esc(t('resume')) + '</button></div></div>' +
      '<p class="caption" id="caption" aria-live="polite"></p>' +
      '<div class="tools">' +
      '<button class="tool" id="toolUndo" data-act="undo">' + icon('undo') + '<span>' + esc(t('tool_undo')) + '</span></button>' +
      '<button class="tool" id="toolNotes" data-act="notes" aria-pressed="false">' + icon('notes') + '<span>' + esc(t('tool_notes')) + '</span></button>' +
      '<button class="tool" id="toolHint" data-act="hint">' + icon('hint') + '<span>' + esc(t('tool_hint')) + '</span><b id="hintLeft"></b></button>' +
      '</div><div class="pad" id="pad">';
    for (var v = 1; v <= 9; v++) {
      html += '<button class="padbtn" data-act="pad" data-v="' + v + '" aria-label="' + esc(t('caption_goal', { n: g.goals[v - 1], name: goalText(g.goals[v - 1]).name })) + '">' +
        '<span class="tile g' + g.goals[v - 1] + '"></span><span class="left"></span></button>';
    }
    html += '<button class="padbtn erase" data-act="erase" aria-label="' + esc(t('tool_erase')) + '">' + icon('erase') + '<span class="eraselbl">' + esc(t('tool_erase')) + '</span></button></div></div>';
    $screen.innerHTML = html;
    $screen.scrollTop = 0;
    ui.lastView = 'game';
    cellEls = [];
    var nodes = $screen.querySelectorAll('.cell');
    for (var n = 0; n < nodes.length; n++) cellEls[+nodes[n].getAttribute('data-i')] = nodes[n];
    layoutBoard();
    paintGame();
  }
  function layoutBoard() {
    var wrap = document.getElementById('boardWrap'), board = document.getElementById('board');
    if (!wrap || !board) return;
    board.style.width = board.style.height = '0px';
    var s = Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight));
    s = Math.max(s, 228);
    board.style.width = board.style.height = s + 'px';
  }

  function isLocked(i) { var g = G(); return g.puzzle[i] !== 0 || (g.cells[i] !== 0 && g.cells[i] === g.solution[i]); }
  function highlightValue() {
    if (ui.focus) return ui.focus;
    var g = G();
    return ui.sel >= 0 ? g.cells[ui.sel] : 0;
  }
  function paintGame() {
    var g = G();
    if (!g || !cellEls.length) return;
    var hv = highlightValue(), sel = ui.sel, dimOthers = S().settings.highlight;
    var counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], i, v;
    for (i = 0; i < 81; i++) {
      v = g.cells[i];
      var given = g.puzzle[i] !== 0, cls = 'cell', html = '', label;
      if (v) {
        var wrong = v !== g.solution[i];
        if (!wrong) counts[v]++;
        cls += given ? ' given' : ' placed';
        if (wrong) cls += ' wrong';
        html = '<span class="tile g' + g.goals[v - 1] + '"></span>';
        if (hv) { if (v === hv) cls += ' same'; else if (dimOthers) cls += ' dim'; }
        label = goalText(g.goals[v - 1]).name;
      } else if (g.notes[i]) {
        html = '<span class="notes">';
        for (var n = 1; n <= 9; n++) {
          html += (g.notes[i] & (1 << n)) ? '<i class="g' + g.goals[n - 1] + (hv === n ? ' hl' : '') + '"></i>' : '<i></i>';
        }
        html += '</span>';
        label = t('tool_notes');
      } else {
        label = '–';
      }
      if (i === sel) cls += ' sel';
      else if (sel >= 0 && (E.ROW[i] === E.ROW[sel] || E.COL[i] === E.COL[sel] || E.BOX[i] === E.BOX[sel])) cls += ' peer';
      if (ui.fx[i]) cls += ' ' + ui.fx[i];
      var el = cellEls[i], sig = cls + '|' + html;
      if (el._sig !== sig) {
        el.className = cls; el.innerHTML = html; el._sig = sig;
        el.setAttribute('aria-label', (E.ROW[i] + 1) + '×' + (E.COL[i] + 1) + ': ' + label);
        if (i === sel) el.setAttribute('aria-selected', 'true'); else el.removeAttribute('aria-selected');
      }
    }
    var pads = document.querySelectorAll('.padbtn[data-v]');
    for (var p = 0; p < pads.length; p++) {
      v = +pads[p].getAttribute('data-v');
      var left = 9 - counts[v], pc = 'padbtn';
      if (left <= 0) pc += ' done';
      if (hv === v) pc += ' active';
      if (ui.notes) { pc += ' noting'; if (sel >= 0 && !g.cells[sel] && (g.notes[sel] & (1 << v))) pc += ' noted'; }
      pads[p].className = pc;
      pads[p].disabled = left <= 0;
      pads[p].querySelector('.left').textContent = left > 0 ? left : '';
    }
    var cap = document.getElementById('caption');
    if (hv) { var gid = g.goals[hv - 1]; cap.textContent = t('caption_goal', { n: gid, name: goalText(gid).name }); }
    else cap.textContent = ui.notes ? t('caption_notes') : t('caption_pick');
    document.getElementById('gMist').textContent = t('mistakes') + ': ' + g.mistakes + '/' + RULES.maxMistakes;
    document.getElementById('gMist').className = g.mistakes ? 'warn' : '';
    document.getElementById('toolUndo').disabled = !g.history.length;
    var tn = document.getElementById('toolNotes');
    tn.className = 'tool' + (ui.notes ? ' on' : '');
    tn.setAttribute('aria-pressed', String(ui.notes));
    var hl = RULES.maxHints - g.hints;
    document.getElementById('hintLeft').textContent = hl;
    document.getElementById('toolHint').disabled = hl <= 0;
    var board = document.getElementById('board');
    board.className = 'board' + (ui.paused ? ' hide' : '');
    document.getElementById('pauseCover').hidden = !ui.paused;
    document.getElementById('pauseBtn').innerHTML = icon(ui.paused ? 'play' : 'pause');
  }
  function setFx(cells, name, ms) {
    cells.forEach(function (i) { ui.fx[i] = name; });
    setTimeout(function () {
      cells.forEach(function (i) { if (ui.fx[i] === name) delete ui.fx[i]; });
      if (ui.inGame) paintGame();
    }, ms || 450);
  }

  // ------------------------------------------------------------ игра: ходы
  function playing() { var g = G(); return ui.inGame && g && g.status === 'playing' && !ui.paused && !ui.modal; }
  function pushHistory(entry) {
    var h = G().history;
    h.push(entry);
    if (h.length > 120) h.shift();
  }
  function onCell(i) {
    if (!playing()) return;
    ui.sel = i;
    ui.focus = 0;
    sfx('tap');
    paintGame();
  }
  function onPad(v) {
    if (!playing()) return;
    var g = G(), sel = ui.sel;
    if (sel < 0 || isLocked(sel)) {
      // Нет клетки для хода: просто показываем, где эта цель уже стоит.
      ui.focus = ui.focus === v ? 0 : v;
      ui.sel = -1;
      sfx('tap');
      paintGame();
      return;
    }
    ui.focus = 0;
    var bit = 1 << v, entry = { i: sel, v: g.cells[sel], n: g.notes[sel], peers: [] };
    if (ui.notes) {
      if (g.cells[sel]) g.cells[sel] = 0;
      g.notes[sel] ^= bit;
      pushHistory(entry);
      sfx('note');
    } else if (g.cells[sel] === v) {
      g.cells[sel] = 0;
      pushHistory(entry);
      sfx('erase');
    } else {
      g.cells[sel] = v;
      pushHistory(entry);
      if (v === g.solution[sel]) {
        afterCorrect(sel, v, entry);
        if (isSolved()) { Store.save(); paintGame(); win(); return; }
      } else {
        g.mistakes++;
        setFx([sel], 'shake', 420);
        sfx('error'); buzz([30, 40, 30]);
        if (g.mistakes >= RULES.maxMistakes) { Store.save(); paintGame(); lose(); return; }
      }
    }
    Store.save();
    paintGame();
  }
  function afterCorrect(i, v, entry) {
    var g = G(), bit = 1 << v;
    g.notes[i] = 0;
    if (S().settings.autoNotes) {
      E.PEERS[i].forEach(function (j) {
        if (g.notes[j] & bit) { if (entry) entry.peers.push([j, g.notes[j]]); g.notes[j] &= ~bit; }
      });
    }
    var done = [];
    [E.ROW, E.COL, E.BOX].forEach(function (map) {
      var unit = [], ok = true;
      for (var k = 0; k < 81; k++) if (map[k] === map[i]) { unit.push(k); if (g.cells[k] !== g.solution[k]) ok = false; }
      if (ok) done = done.concat(unit);
    });
    if (done.length) { setFx(done, 'flash', 600); sfx('unit'); buzz(20); }
    else { setFx([i], 'pop', 300); sfx('place'); buzz(10); }
  }
  function isSolved() {
    var g = G();
    for (var i = 0; i < 81; i++) if (g.cells[i] !== g.solution[i]) return false;
    return true;
  }
  function onErase() {
    if (!playing()) return;
    var g = G(), sel = ui.sel;
    if (sel < 0 || isLocked(sel) || (!g.cells[sel] && !g.notes[sel])) return;
    pushHistory({ i: sel, v: g.cells[sel], n: g.notes[sel], peers: [] });
    if (g.cells[sel]) g.cells[sel] = 0; else g.notes[sel] = 0;
    sfx('erase');
    Store.save();
    paintGame();
  }
  function onUndo() {
    if (!playing()) return;
    var g = G(), e = g.history.pop();
    if (!e) return;
    g.cells[e.i] = e.v;
    g.notes[e.i] = e.n;
    (e.peers || []).forEach(function (p) { g.notes[p[0]] = p[1]; });
    ui.sel = e.i; ui.focus = 0;
    sfx('erase');
    Store.save();
    paintGame();
  }
  function onNotes() {
    if (!playing()) return;
    ui.notes = !ui.notes;
    sfx('tap');
    paintGame();
  }
  function onHint() {
    if (!playing()) return;
    var g = G();
    if (g.hints >= RULES.maxHints) { toast(t('toast_no_hints')); return; }
    var i = ui.sel;
    if (i < 0 || isLocked(i)) {
      var grid = g.cells.map(function (v, k) { return v === g.solution[k] ? v : 0; });
      i = E.hintCell(grid);
    }
    if (i < 0) return;
    g.hints++;
    g.cells[i] = g.solution[i];
    g.history = g.history.filter(function (e) { return e.i !== i; });
    ui.sel = i; ui.focus = 0;
    afterCorrect(i, g.solution[i], null);
    sfx('hint');
    Store.save();
    paintGame();
    if (isSolved()) win();
  }
  function togglePause(force) {
    var g = G();
    if (!ui.inGame || !g || g.status !== 'playing') return;
    ui.paused = force === undefined ? !ui.paused : force;
    Store.save();
    paintGame();
  }

  // ------------------------------------------------------------ игра: финал
  function win() {
    var g = G();
    g.status = 'won';
    // Для карточки «О цели» берём цель, которая встречалась игроку реже всего.
    var solved = S().goalsSolved, pick = g.goals[0], low = Infinity;
    g.goals.forEach(function (id) {
      var c = (solved[id] || 0) + Math.random() * 0.5;
      if (c < low) { low = c; pick = id; }
    });
    var res = Store.recordWin({ board: g.board, diff: g.diff, seconds: g.seconds, mistakes: g.mistakes, hints: g.hints, goals: g.goals, dateKey: g.dateKey });
    var summary = { board: g.board, diff: g.diff, mode: g.mode, seconds: g.seconds, mistakes: g.mistakes, hints: g.hints };
    S().game = null;
    Store.save();
    if (Cloud.state.user) {
      Cloud.submitScore(globalBoardId(summary.board), res.entry, S().settings.name || t('rec_player'));
      Cloud.sync();
      ui.global.state = 'idle';
    }
    sfx('win'); buzz([20, 60, 20, 60, 40]);
    confetti();
    var html = '<h2 class="win-title">' + esc(t('win_title')) + '</h2>' +
      (res.isRecord ? '<p class="pill good">' + esc(t('new_record')) + '</p>' : '') +
      '<dl class="result"><div><dt>' + esc(t('win_time')) + '</dt><dd>' + fmtTime(summary.seconds) + '</dd></div>' +
      '<div><dt>' + esc(t('win_mistakes')) + '</dt><dd>' + summary.mistakes + '</dd></div>' +
      '<div><dt>' + esc(t('win_hints')) + '</dt><dd>' + summary.hints + '</dd></div>' +
      '<div class="total"><dt>' + esc(t('win_score')) + '</dt><dd>' + fmtTime(res.score) + '</dd></div></dl>' +
      (res.achievements.length ? '<div class="pills">' + res.achievements.map(function (id) { return '<span class="pill">' + esc(t('toast_ach', { name: t('ach_' + id) })) + '</span>'; }).join('') + '</div>' : '') +
      '<p class="eyebrow">' + esc(t('about_goal')) + '</p>' + goalCard(pick);
    var actions =
      (summary.mode === 'daily' ? '' : '<button class="btn primary" data-act="again-new" data-diff="' + summary.diff + '" data-autofocus>' + esc(t('btn_new')) + '</button>') +
      '<button class="btn' + (summary.mode === 'daily' ? ' primary' : '') + '" data-act="go-home">' + esc(t('btn_home')) + '</button>';
    openModal(html, actions, { cls: 'win', onClose: function () { if (ui.inGame) leaveGame(); } });
  }
  function lose() {
    var g = G();
    g.status = 'lost';
    Store.recordLoss(g.board);
    sfx('over'); buzz([60, 40, 120]);
    openModal('<h2>' + esc(t('over_title')) + '</h2><p>' + esc(t('over_text')) + '</p>',
      '<button class="btn primary" data-act="retry" data-autofocus>' + esc(t('btn_again')) + '</button>' +
      '<button class="btn" data-act="go-home">' + esc(t('btn_home')) + '</button>',
      { onClose: function () { if (G() && G().status === 'lost') { S().game = null; Store.save(); } if (ui.inGame) leaveGame(); } });
  }
  function retry() {
    var g = G();
    if (!g) return;
    g.cells = g.puzzle.slice();
    for (var i = 0; i < 81; i++) g.notes[i] = 0;
    g.mistakes = 0; g.hints = 0; g.seconds = 0; g.history = []; g.status = 'playing';
    Store.recordStart(g.board);
    ui.modal = null; $modal.hidden = true; $modal.innerHTML = '';
    enterGame();
  }

  // ------------------------------------------------------------ конфетти
  function confetti() {
    var cv = document.getElementById('confetti');
    if (!cv || !cv.getContext) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var c = cv.getContext('2d'), W = cv.width = window.innerWidth, H = cv.height = window.innerHeight;
    var colors = ['#5B3DF5', '#FFB703', '#2EC4B6', '#FF5D73', '#8ECAE6', '#B8F2A1'];
    var parts = [];
    for (var i = 0; i < 90; i++) {
      parts.push({ x: Math.random() * W, y: -20 - Math.random() * H * 0.4, w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
        vx: -1.5 + Math.random() * 3, vy: 2 + Math.random() * 3.5, r: Math.random() * 6.28, vr: -0.2 + Math.random() * 0.4, col: colors[i % colors.length] });
    }
    var start = Date.now();
    cv.style.display = 'block';
    (function frame() {
      var el = Date.now() - start;
      c.clearRect(0, 0, W, H);
      parts.forEach(function (p) {
        p.x += p.vx; p.y += p.vy; p.r += p.vr;
        c.save(); c.translate(p.x, p.y); c.rotate(p.r);
        c.globalAlpha = Math.max(0, 1 - el / 2600);
        c.fillStyle = p.col; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore();
      });
      if (el < 2600) requestAnimationFrame(frame); else { c.clearRect(0, 0, W, H); cv.style.display = 'none'; }
    })();
  }

  // ------------------------------------------------------------ события
  var nameTimer = null;
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-act]') : null;
    if (!el) return;
    var act = el.getAttribute('data-act');
    switch (act) {
      case 'cell': onCell(+el.getAttribute('data-i')); break;
      case 'pad': onPad(+el.getAttribute('data-v')); break;
      case 'erase': onErase(); break;
      case 'undo': onUndo(); break;
      case 'notes': onNotes(); break;
      case 'hint': onHint(); break;
      case 'pause': togglePause(); break;
      case 'leave': leaveGame(); break;
      case 'tab': ui.tab = el.getAttribute('data-tab'); render(); break;
      case 'continue': enterGame(); break;
      case 'daily': requestGame('daily'); break;
      case 'new': requestGame('classic', el.getAttribute('data-diff')); break;
      case 'goal': showGoal(+el.getAttribute('data-goal')); break;
      case 'rec-board': ui.recBoard = el.getAttribute('data-board'); ui.global.state = 'idle'; render(); break;
      case 'rec-view': ui.recView = el.getAttribute('data-view'); ui.global.state = 'idle'; render(); break;
      case 'lang': S().settings.lang = el.getAttribute('data-lang'); Store.save(); render(); break;
      case 'toggle':
        var key = el.getAttribute('data-key');
        S().settings[key] = !S().settings[key];
        Store.save();
        if (key === 'sound' && S().settings.sound) sfx('place');
        if (key === 'haptics' && S().settings.haptics) buzz(20);
        render();
        break;
      case 'reset': confirmBox(t('reset_q'), t('reset_yes'), function () { Store.resetProgress(); dailyPreview = null; render(); }, true); break;
      case 'auth': ui.authMode = 'in'; showAuth(); break;
      case 'auth-switch': ui.authMode = ui.authMode === 'in' ? 'up' : 'in'; showAuth(); break;
      case 'auth-forgot': forgotPassword(); break;
      case 'signout': Cloud.signOut(); break;
      case 'delete-account':
        confirmBox(t('delete_q'), t('delete_yes'), function () {
          Cloud.deleteAccount().then(function (res) { if (!res.ok) toast(t(res.error)); });
        }, true);
        break;
      case 'confirm-yes': var fn = ui.confirmYes; ui.confirmYes = null; closeModal(); if (fn) fn(); break;
      case 'modal-close': closeModal(); break;
      case 'backdrop': if (ui.modal && ui.modal.dismissable) closeModal(); break;
      case 'retry': retry(); break;
      case 'go-home': closeModal(); if (ui.inGame) leaveGame(); break;
      case 'again-new':
        var d = el.getAttribute('data-diff');
        ui.modal = null; $modal.hidden = true; $modal.innerHTML = '';
        beginGame('classic', d);
        break;
    }
  });
  document.addEventListener('submit', function (ev) {
    if (ev.target && ev.target.id === 'authForm') { ev.preventDefault(); submitAuth(); }
  });
  document.addEventListener('input', function (ev) {
    if (ev.target && ev.target.id === 'playerName') {
      S().settings.name = ev.target.value.slice(0, 20);
      clearTimeout(nameTimer);
      nameTimer = setTimeout(function () { Store.touch(); }, 400);
    }
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && ui.modal && ui.modal.dismissable) { closeModal(); return; }
    if (!ui.inGame || ui.modal) return;
    var tag = (ev.target && ev.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    var k = ev.key;
    if (k === 'p' || k === 'P' || k === 'з' || k === 'З') { togglePause(); return; }
    if (!playing()) return;
    if (k >= '1' && k <= '9') { onPad(+k); ev.preventDefault(); return; }
    if (k === 'Backspace' || k === 'Delete' || k === '0') { onErase(); ev.preventDefault(); return; }
    if (k === 'n' || k === 'N' || k === 'т' || k === 'Т') { onNotes(); return; }
    if (k === 'h' || k === 'H' || k === 'р' || k === 'Р') { onHint(); return; }
    if (k === 'u' || k === 'U' || k === 'г' || k === 'Г' || ((ev.ctrlKey || ev.metaKey) && (k === 'z' || k === 'Z'))) { onUndo(); ev.preventDefault(); return; }
    var move = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[k];
    if (move) {
      var s = ui.sel < 0 ? 40 : ui.sel, r = E.ROW[s], c = E.COL[s];
      if (k === 'ArrowUp') r = (r + 8) % 9; if (k === 'ArrowDown') r = (r + 1) % 9;
      if (k === 'ArrowLeft') c = (c + 8) % 9; if (k === 'ArrowRight') c = (c + 1) % 9;
      ui.sel = r * 9 + c; ui.focus = 0;
      paintGame();
      ev.preventDefault();
    }
  });
  window.addEventListener('resize', function () { if (ui.inGame) layoutBoard(); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { Store.save(); if (playing()) togglePause(true); }
  });

  // Таймер: идёт только во время активной игры.
  setInterval(function () {
    if (!playing() || document.hidden) return;
    var g = G();
    g.seconds++;
    var el = document.getElementById('gTimer');
    if (el) el.textContent = fmtTime(g.seconds);
    if (g.seconds % 5 === 0) Store.save();
  }, 1000);

  // Кнопка «Назад» на Android (работает в сборке Capacitor с плагином @capacitor/app).
  try {
    var capApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (capApp && capApp.addListener) {
      capApp.addListener('backButton', function () {
        if (ui.modal) { if (ui.modal.dismissable) closeModal(); }
        else if (ui.inGame) leaveGame();
        else if (ui.tab !== 'home') { ui.tab = 'home'; render(); }
        else if (capApp.exitApp) capApp.exitApp();
      });
    }
  } catch (e) { /* не в приложении */ }

  // ------------------------------------------------------------ запуск
  (function boot() {
    var s = S().settings;
    if (LANGS.indexOf(s.lang) < 0) { s.lang = detectLang(); }
    var g = G();
    if (g && (g.status !== 'playing' || (g.board === 'daily' && g.dateKey !== Store.dateKey()))) { S().game = null; }
    Store.save();
    Cloud.onChange(function () {
      if (!ui.inGame && !ui.modal && (ui.tab === 'settings' || ui.tab === 'records')) render();
    });
    render();
    Cloud.init();
  })();

  // Небольшой доступ для автотестов.
  window.SDGokuApp = { ui: ui, render: render, t: t };
})();
