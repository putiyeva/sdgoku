// Прогон игры в браузере. Запуск: NODE_PATH=<путь к node_modules с playwright> node tests/ui.test.cjs [папка для скриншотов]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || path.join(__dirname, '..', 'shots');
const page_url = 'file://' + path.join(__dirname, '..', 'dist', 'sdgoku.html');
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, locale: 'ru-RU', hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(page_url);
  await page.waitForSelector('.wordmark');
  await page.waitForTimeout(400);
  await page.screenshot({ path: out + '/01-home.png' });
  ok(await page.locator('.level').count() === 4, 'home shows 4 levels');
  ok(await page.evaluate(() => document.documentElement.lang) === 'ru', 'language detected as ru');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal overflow on home');

  // новая игра: средний
  await page.locator('.level[data-diff="medium"]').click();
  await page.waitForSelector('.board');
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/02-game-start.png' });
  const geo = await page.evaluate(() => {
    const r = id => { const b = document.querySelector(id).getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, bottom: b.bottom }; };
    return { board: r('#board'), pad: r('#pad'), vh: window.innerHeight, vw: window.innerWidth, cell: r('.cell') };
  });
  console.log('geometry', JSON.stringify(geo));
  ok(Math.abs(geo.board.w - geo.board.h) < 1, 'board is square');
  ok(geo.pad.bottom <= geo.vh + 0.5, 'pad fits the screen');
  ok(geo.board.w >= 300, 'board is large enough: ' + geo.board.w);

  const game = () => page.evaluate(() => JSON.parse(JSON.stringify(window.SDGokuStore.data.game)));
  let g = await game();
  ok(g.goals.length === 9 && g.cells.filter(Boolean).length === 36, 'medium game has 36 givens and 9 goals');
  const empties = g.cells.map((v, i) => v ? -1 : i).filter(i => i >= 0);

  // неверный ход
  const i0 = empties[0];
  const wrongV = (g.solution[i0] % 9) + 1;
  await page.locator(`.cell[data-i="${i0}"]`).click();
  await page.locator(`.padbtn[data-v="${wrongV}"]`).click();
  g = await game();
  ok(g.mistakes === 1 && g.cells[i0] === wrongV, 'wrong move counts a mistake');
  ok(await page.locator(`.cell[data-i="${i0}"]`).evaluate(e => e.classList.contains('wrong')), 'wrong cell is marked');
  // отмена
  await page.locator('#toolUndo').click();
  g = await game();
  ok(g.cells[i0] === 0 && g.mistakes === 1, 'undo removes the wrong tile, mistake stays');
  // заметки
  await page.locator(`.cell[data-i="${i0}"]`).click();
  await page.locator('#toolNotes').click();
  await page.locator('.padbtn[data-v="1"]').click();
  await page.locator('.padbtn[data-v="5"]').click();
  await page.locator('.padbtn[data-v="9"]').click();
  g = await game();
  ok(g.notes[i0] === ((1 << 1) | (1 << 5) | (1 << 9)), 'notes are stored');
  await page.screenshot({ path: out + '/03-game-notes.png' });
  await page.locator('#toolNotes').click();
  // верный ход
  await page.locator(`.padbtn[data-v="${g.solution[i0]}"]`).click();
  g = await game();
  ok(g.cells[i0] === g.solution[i0] && g.notes[i0] === 0, 'correct move places the tile and clears notes');
  // подсказка
  await page.locator('#toolHint').click();
  g = await game();
  ok(g.hints === 1, 'hint used');
  await page.waitForTimeout(700);
  await page.screenshot({ path: out + '/04-game-mid.png' });
  // пауза
  await page.locator('#pauseBtn').click();
  ok(await page.locator('#pauseCover').isVisible(), 'pause cover visible');
  await page.screenshot({ path: out + '/05-paused.png' });
  await page.locator('#pauseCover .btn').click();
  // сохранение: перезагрузка страницы и «Продолжить»
  await page.waitForTimeout(1200);
  await page.reload();
  await page.waitForSelector('.continue');
  await page.screenshot({ path: out + '/06-home-continue.png' });
  await page.locator('.continue').click();
  await page.waitForSelector('.board');
  const g2 = await game();
  ok(g2.cells.join('') === g.cells.join('') && g2.hints === 1 && g2.mistakes === 1, 'game restored after reload');
  // дорешать
  g = g2;
  for (let i = 0; i < 81; i++) {
    if (g.cells[i] === g.solution[i]) continue;
    await page.locator(`.cell[data-i="${i}"]`).click();
    await page.locator(`.padbtn[data-v="${g.solution[i]}"]`).click();
    g.cells[i] = g.solution[i];
  }
  await page.waitForSelector('.sheet.win');
  await page.waitForTimeout(500);
  await page.screenshot({ path: out + '/07-win.png' });
  const st = await page.evaluate(() => JSON.parse(JSON.stringify(window.SDGokuStore.data)));
  ok(st.game === null, 'game cleared after win');
  ok(st.boards.medium.won === 1 && st.boards.medium.started === 1, 'stats updated');
  ok(st.records.medium.length === 1 && st.records.medium[0].hints === 1, 'record saved with hint');
  ok(st.records.medium[0].score === st.records.medium[0].seconds + 30, 'score = time + 30s per hint');
  ok(Object.keys(st.goalsSolved).length === 9, '9 goals collected');
  ok(st.achievements.first_win && st.achievements.win_medium && !st.achievements.flawless && !st.achievements.no_hints, 'achievements evaluated');
  await page.locator('[data-act="go-home"]').click();
  await page.waitForSelector('.wordmark');

  // три ошибки -> конец игры -> повтор
  await page.locator('.level[data-diff="easy"]').click();
  await page.waitForSelector('.board');
  g = await game();
  const e3 = g.cells.map((v, i) => v ? -1 : i).filter(i => i >= 0).slice(0, 3);
  for (const i of e3) {
    await page.locator(`.cell[data-i="${i}"]`).click();
    await page.locator(`.padbtn[data-v="${(g.solution[i] % 9) + 1}"]`).click();
  }
  await page.waitForSelector('[data-act="retry"]');
  await page.screenshot({ path: out + '/08-game-over.png' });
  await page.locator('[data-act="retry"]').click();
  await page.waitForTimeout(200);
  g = await game();
  ok(g && g.mistakes === 0 && g.status === 'playing', 'retry restarts the same puzzle');
  await page.locator('[data-act="leave"]').click();

  // головоломка дня
  await page.waitForSelector('[data-act="daily"]');
  await page.locator('[data-act="daily"]').click();
  await page.locator('[data-act="confirm-yes"]').click().catch(() => {});
  await page.waitForSelector('.board');
  g = await game();
  ok(g.board === 'daily' && g.dateKey, 'daily game started');
  for (let i = 0; i < 81; i++) {
    if (g.cells[i] === g.solution[i]) continue;
    await page.locator(`.cell[data-i="${i}"]`).click();
    await page.locator(`.padbtn[data-v="${g.solution[i]}"]`).click();
  }
  await page.waitForSelector('.sheet.win');
  await page.locator('[data-act="go-home"]').click();
  await page.waitForSelector('.done-line');
  await page.screenshot({ path: out + '/09-home-daily-done.png' });
  const st2 = await page.evaluate(() => JSON.parse(JSON.stringify(window.SDGokuStore.data)));
  ok(st2.daily.streak === 1 && Object.keys(st2.daily.done).length === 1, 'daily streak recorded');
  ok(st2.achievements.flawless && st2.achievements.no_hints, 'flawless + no-hints achievements');

  // вкладки
  for (const [tab, name] of [['goals', '10-goals'], ['stats', '11-stats'], ['records', '12-records'], ['settings', '13-settings']]) {
    await page.locator(`.tab[data-tab="${tab}"]`).click();
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: false });
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.getElementById('screen').scrollWidth <= document.getElementById('screen').clientWidth + 1), `no horizontal overflow on ${tab}`);
  }
  // карточка цели
  await page.locator('.tab[data-tab="goals"]').click();
  await page.locator('.goalbtn[data-goal="6"]').click();
  await page.waitForSelector('.sheet .fact');
  await page.screenshot({ path: out + '/14-goal-card.png' });
  await page.locator('[data-act="modal-close"]').click();
  // общий рейтинг без сервера
  await page.locator('.tab[data-tab="records"]').click();
  await page.locator('[data-act="rec-view"][data-view="global"]').click();
  ok(await page.locator('#recList .notice').count() === 1, 'global leaderboard shows the server notice');
  // языки
  await page.locator('.tab[data-tab="settings"]').click();
  for (const lang of ['az', 'en']) {
    await page.locator(`[data-act="lang"][data-lang="${lang}"]`).click();
    await page.waitForTimeout(100);
    ok(await page.evaluate(() => document.documentElement.lang) === lang, 'language switched to ' + lang);
    await page.screenshot({ path: `${out}/15-settings-${lang}.png` });
    await page.locator('.tab[data-tab="home"]').click();
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${out}/16-home-${lang}.png` });
    await page.locator('.tab[data-tab="stats"]').click();
    await page.screenshot({ path: `${out}/17-stats-${lang}.png` });
    await page.locator('.tab[data-tab="settings"]').click();
  }
  // игра на азербайджанском в тёмной теме и на узком экране
  await page.locator('[data-act="lang"][data-lang="az"]').click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 360, height: 600 });
  await page.locator('.tab[data-tab="home"]').click();
  await page.locator('.level[data-diff="hard"]').click();
  await page.waitForSelector('.board');
  g = await game();
  const filled = g.cells.findIndex(v => v);
  await page.locator(`.cell[data-i="${filled}"]`).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: out + '/18-game-az-dark-small.png' });
  const geo2 = await page.evaluate(() => ({ pad: document.querySelector('#pad').getBoundingClientRect().bottom, vh: window.innerHeight, board: document.querySelector('#board').getBoundingClientRect().width }));
  console.log('small geometry', JSON.stringify(geo2));
  ok(geo2.pad <= geo2.vh + 0.5, 'pad fits on a 360×600 screen');
  await page.locator('[data-act="leave"]').click();
  await page.screenshot({ path: out + '/19-home-az-dark.png' });

  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(fail ? fail + ' FAILED' : 'ALL UI TESTS PASSED');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
