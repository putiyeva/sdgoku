// Запуск: node tests/engine.test.js
const E = require('../www/js/engine.js');
let fail = 0;
function ok(cond, msg) { if (!cond) { fail++; console.log('FAIL', msg); } }
function validSolution(g) {
  for (let u = 0; u < 9; u++) {
    const r = new Set(), c = new Set(), b = new Set();
    for (let i = 0; i < 81; i++) {
      if (E.ROW[i] === u) r.add(g[i]);
      if (E.COL[i] === u) c.add(g[i]);
      if (E.BOX[i] === u) b.add(g[i]);
    }
    if (r.size !== 9 || c.size !== 9 || b.size !== 9) return false;
  }
  return g.every(v => v >= 1 && v <= 9);
}
const summary = {};
for (const diff of ['easy', 'medium', 'hard', 'expert']) {
  const N = 40; let t0 = Date.now(), clues = [], singles = 0, maxMs = 0;
  for (let k = 0; k < N; k++) {
    const s = Date.now();
    const p = E.generate(diff, 1000 + k * 7919 + diff.length);
    maxMs = Math.max(maxMs, Date.now() - s);
    ok(validSolution(p.solution), diff + ' solution valid');
    ok(E.countSolutions(p.puzzle, 2) === 1, diff + ' unique');
    ok(p.puzzle.every((v, i) => v === 0 || v === p.solution[i]), diff + ' clues match solution');
    const sol = E.solve(p.puzzle);
    ok(sol && sol.join('') === p.solution.join(''), diff + ' solver agrees');
    clues.push(p.clues);
    if (E.solvableBySingles(p.puzzle)) singles++;
    if (diff === 'easy' || diff === 'medium') ok(E.solvableBySingles(p.puzzle), diff + ' singles only');
  }
  summary[diff] = { avgClues: (clues.reduce((a, b) => a + b) / N).toFixed(1), min: Math.min(...clues), max: Math.max(...clues), singlesSolvable: singles + '/' + N, avgMs: ((Date.now() - t0) / N).toFixed(0), maxMs };
}
console.table(summary);
// детерминированность
const a = E.generate('medium', E.dailySeed('2026-11-12')), b = E.generate('medium', E.dailySeed('2026-11-12'));
ok(a.puzzle.join('') === b.puzzle.join(''), 'daily deterministic');
const c = E.generate('medium', E.dailySeed('2026-11-13'));
ok(a.puzzle.join('') !== c.puzzle.join(''), 'daily differs by date');
// цели
const seen = new Set();
for (let k = 0; k < 200; k++) {
  const g = E.pickGoals(k * 31 + 5);
  ok(g.length === 9 && new Set(g).size === 9, 'nine distinct goals');
  ok(g.every(x => x >= 1 && x <= 17), 'goal ids in range');
  ok(g.join() === g.slice().sort((x, y) => x - y).join(), 'goals sorted');
  g.forEach(x => seen.add(x));
}
ok(seen.size === 17, 'all 17 goals appear');
// подсказка всегда указывает на пустую клетку
const hp = E.generate('expert', 4242);
let g = hp.puzzle.slice(), steps = 0;
while (g.includes(0)) { const i = E.hintCell(g); ok(i >= 0 && g[i] === 0, 'hint empty cell'); g[i] = hp.solution[i]; steps++; }
ok(g.join('') === hp.solution.join(''), 'hints finish the puzzle');
console.log(fail ? fail + ' FAILED' : 'ALL ENGINE TESTS PASSED');
process.exit(fail ? 1 : 0);
