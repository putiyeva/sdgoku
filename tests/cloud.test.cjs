// Проверка серверного модуля на заглушке Firebase. Запуск: NODE_PATH=... node tests/cloud.test.cjs
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, locale: 'ru-RU', hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(fs.readFileSync(path.join(__dirname, 'firebase-mock.js'), 'utf8'));
  await page.addInitScript(() => {
    let cfg;
    Object.defineProperty(window, 'SDGOKU_CONFIG', { get() { return cfg; }, set(v) { v.firebase = { mock: true }; cfg = v; } });
  });
  await page.goto('file://' + path.join(__dirname, '..', 'dist', 'sdgoku.html'));
  await page.waitForSelector('.wordmark');
  const solve = async () => {
    const g = await page.evaluate(() => JSON.parse(JSON.stringify(window.SDGokuStore.data.game)));
    for (let i = 0; i < 81; i++) {
      if (g.cells[i] === g.solution[i]) continue;
      await page.locator(`.cell[data-i="${i}"]`).click();
      await page.locator(`.padbtn[data-v="${g.solution[i]}"]`).click();
    }
    await page.waitForSelector('.sheet.win');
  };
  const data = () => page.evaluate(() => JSON.parse(JSON.stringify(window.SDGokuStore.data)));

  await page.locator('.tab[data-tab="settings"]').click();
  await page.waitForSelector('[data-act="auth"]');
  ok(true, 'settings offer email sign-in when the server is configured');
  await page.locator('[data-act="auth"]').click();
  await page.fill('#authEmail', 'not-an-email'); await page.fill('#authPass', '123456');
  await page.locator('#authForm button[type=submit]').click();
  ok((await page.textContent('#authMsg')).includes('Проверьте адрес'), 'invalid email is rejected');
  await page.fill('#authEmail', 'player@example.org'); await page.fill('#authPass', '123');
  await page.locator('#authForm button[type=submit]').click();
  ok((await page.textContent('#authMsg')).includes('не короче 6'), 'short password is rejected');
  await page.fill('#authPass', 'secret12');
  await page.locator('#authForm button[type=submit]').click();
  await page.waitForTimeout(150);
  ok((await page.textContent('#authMsg')).includes('Неверная почта'), 'unknown account cannot sign in');
  await page.locator('[data-act="auth-switch"]').click();
  await page.fill('#authEmail', 'player@example.org'); await page.fill('#authPass', 'secret12');
  await page.locator('#authForm button[type=submit]').click();
  await page.waitForSelector('[data-act="signout"]');
  ok((await page.textContent('.view-settings')).includes('player@example.org'), 'signed up and signed in');
  await page.fill('#playerName', 'Тест'); await page.waitForTimeout(500);

  await page.locator('.tab[data-tab="home"]').click();
  await page.locator('.level[data-diff="easy"]').click();
  await page.waitForSelector('.board');
  await solve();
  await page.locator('[data-act="go-home"]').click();
  await page.waitForTimeout(200);
  const docs = await page.evaluate(() => JSON.parse(JSON.stringify(window.firebase.__docs)));
  ok(docs['users/uid1'] && docs['users/uid1'].progress.boards.easy.won === 1, 'progress pushed to the server');
  ok(docs['leaderboards/easy/scores/uid1'] && docs['leaderboards/easy/scores/uid1'].name === 'Тест', 'score posted to the leaderboard');
  ok(Array.isArray(docs['users/uid1'].posted) && docs['users/uid1'].posted[0] === 'easy', 'posted boards are tracked for deletion');

  await page.locator('.tab[data-tab="records"]').click();
  await page.locator('[data-act="rec-view"][data-view="global"]').click();
  await page.waitForSelector('#recList .ranks li.me');
  ok((await page.textContent('#recList')).includes('Тест'), 'leaderboard lists the player');

  // «другое устройство»: выход, сброс локального прогресса, вход -> прогресс возвращается
  await page.locator('.tab[data-tab="settings"]').click();
  await page.locator('[data-act="signout"]').click();
  await page.waitForSelector('[data-act="auth"]');
  await page.locator('[data-act="reset"]').click();
  await page.locator('[data-act="confirm-yes"]').click();
  ok((await data()).boards.easy.won === 0, 'local progress reset');
  await page.locator('[data-act="auth"]').click();
  await page.fill('#authEmail', 'player@example.org'); await page.fill('#authPass', 'wrong-pass');
  await page.locator('#authForm button[type=submit]').click();
  await page.waitForTimeout(150);
  ok((await page.textContent('#authMsg')).includes('Неверная почта'), 'wrong password is rejected');
  await page.fill('#authPass', 'secret12');
  await page.locator('#authForm button[type=submit]').click();
  await page.waitForSelector('[data-act="signout"]');
  await page.waitForTimeout(200);
  const d2 = await data();
  ok(d2.boards.easy.won === 1 && d2.records.easy.length === 1 && d2.achievements.first_win, 'progress restored from the server after sign-in');
  ok(d2.settings.name === 'Тест', 'player name restored');

  // удаление аккаунта
  await page.locator('[data-act="delete-account"]').click();
  await page.locator('[data-act="confirm-yes"]').click();
  await page.waitForSelector('[data-act="auth"]');
  const docs2 = await page.evaluate(() => ({ d: Object.keys(window.firebase.__docs), u: Object.keys(window.firebase.__users) }));
  ok(docs2.d.length === 0 && docs2.u.length === 0, 'account deletion removes the profile, the scores and the login');
  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(fail ? fail + ' FAILED' : 'ALL CLOUD TESTS PASSED');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
