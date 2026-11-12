/* SDGoku — движок судоку: генератор, решатель, подсказки.
   Не зависит от интерфейса; работает и в браузере, и в Node (для тестов). */
(function (root) {
  'use strict';

  // ---- случайные числа с зерном (одинаковая головоломка дня у всех) ----
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashString(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function shuffle(arr, rnd) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  // ---- геометрия поля ----
  var ROW = [], COL = [], BOX = [], PEERS = [], UNITS = [];
  (function () {
    var i, j;
    for (i = 0; i < 81; i++) {
      ROW[i] = Math.floor(i / 9);
      COL[i] = i % 9;
      BOX[i] = Math.floor(ROW[i] / 3) * 3 + Math.floor(COL[i] / 3);
    }
    for (i = 0; i < 81; i++) {
      var p = [];
      for (j = 0; j < 81; j++) {
        if (j !== i && (ROW[i] === ROW[j] || COL[i] === COL[j] || BOX[i] === BOX[j])) p.push(j);
      }
      PEERS[i] = p;
    }
    for (var u = 0; u < 9; u++) {
      var r = [], c = [], b = [];
      for (i = 0; i < 81; i++) {
        if (ROW[i] === u) r.push(i);
        if (COL[i] === u) c.push(i);
        if (BOX[i] === u) b.push(i);
      }
      UNITS.push(r, c, b);
    }
  })();

  var ALL = 0x3FE; // биты 1..9
  function popcount(m) {
    var n = 0;
    while (m) { m &= m - 1; n++; }
    return n;
  }

  // ---- решатель с подсчётом решений (до limit) ----
  function Solver(grid) {
    this.g = grid.slice();
    this.rows = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    this.cols = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    this.boxes = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    this.valid = true;
    for (var i = 0; i < 81; i++) {
      var v = this.g[i];
      if (!v) continue;
      var bit = 1 << v;
      if ((this.rows[ROW[i]] | this.cols[COL[i]] | this.boxes[BOX[i]]) & bit) { this.valid = false; return; }
      this.rows[ROW[i]] |= bit; this.cols[COL[i]] |= bit; this.boxes[BOX[i]] |= bit;
    }
  }
  Solver.prototype.search = function (limit, rnd, onSolution) {
    var self = this, g = this.g, count = 0;
    function rec() {
      var best = -1, bestMask = 0, bestN = 10;
      for (var i = 0; i < 81; i++) {
        if (g[i]) continue;
        var m = ~(self.rows[ROW[i]] | self.cols[COL[i]] | self.boxes[BOX[i]]) & ALL;
        if (!m) return;
        var n = popcount(m);
        if (n < bestN) { bestN = n; best = i; bestMask = m; if (n === 1) break; }
      }
      if (best < 0) {
        count++;
        if (onSolution) onSolution(g.slice());
        return;
      }
      var vals = [];
      for (var v = 1; v <= 9; v++) if (bestMask & (1 << v)) vals.push(v);
      if (rnd) shuffle(vals, rnd);
      for (var k = 0; k < vals.length; k++) {
        var bit = 1 << vals[k];
        g[best] = vals[k];
        self.rows[ROW[best]] |= bit; self.cols[COL[best]] |= bit; self.boxes[BOX[best]] |= bit;
        rec();
        g[best] = 0;
        self.rows[ROW[best]] &= ~bit; self.cols[COL[best]] &= ~bit; self.boxes[BOX[best]] &= ~bit;
        if (count >= limit) return;
      }
    }
    if (this.valid) rec();
    return count;
  };

  function countSolutions(grid, limit) {
    return new Solver(grid).search(limit || 2, null, null);
  }
  function solve(grid) {
    var out = null;
    new Solver(grid).search(1, null, function (s) { out = s; });
    return out;
  }
  function fullGrid(rnd) {
    var out = null, empty = [];
    for (var i = 0; i < 81; i++) empty.push(0);
    new Solver(empty).search(1, rnd, function (s) { out = s; });
    return out;
  }

  // ---- «человеческий» решатель: только одиночки (открытые и скрытые) ----
  function candidates(grid, i) {
    var used = 0, p = PEERS[i];
    for (var k = 0; k < p.length; k++) if (grid[p[k]]) used |= 1 << grid[p[k]];
    return ~used & ALL;
  }
  // Возвращает {index, value, kind} для следующего очевидного хода или null.
  function nextSingle(grid) {
    var i, v;
    for (i = 0; i < 81; i++) {
      if (grid[i]) continue;
      var m = candidates(grid, i);
      if (m && !(m & (m - 1))) {
        for (v = 1; v <= 9; v++) if (m === (1 << v)) return { index: i, value: v, kind: 'naked' };
      }
    }
    for (var u = 0; u < UNITS.length; u++) {
      var unit = UNITS[u];
      for (v = 1; v <= 9; v++) {
        var bit = 1 << v, pos = -1, n = 0, present = false;
        for (var k = 0; k < 9; k++) {
          var c = unit[k];
          if (grid[c] === v) { present = true; break; }
          if (!grid[c] && (candidates(grid, c) & bit)) { n++; pos = c; }
        }
        if (!present && n === 1) return { index: pos, value: v, kind: 'hidden' };
      }
    }
    return null;
  }
  function solvableBySingles(grid) {
    var g = grid.slice(), left = 0;
    for (var i = 0; i < 81; i++) if (!g[i]) left++;
    while (left > 0) {
      var s = nextSingle(g);
      if (!s) return false;
      g[s.index] = s.value;
      left--;
    }
    return true;
  }

  // ---- генератор ----
  var TARGET_CLUES = { easy: 45, medium: 36, hard: 30, expert: 25 };

  function dig(solution, diff, rnd) {
    var puzzle = solution.slice();
    var order = shuffle(Array.from({ length: 81 }, function (_, i) { return i; }), rnd);
    var target = TARGET_CLUES[diff] || 36;
    var singlesOnly = diff === 'easy' || diff === 'medium';
    var clues = 81;
    for (var k = 0; k < order.length && clues > target; k++) {
      var i = order[k], keep = puzzle[i];
      puzzle[i] = 0;
      var ok = countSolutions(puzzle, 2) === 1;
      if (ok && singlesOnly) ok = solvableBySingles(puzzle);
      if (ok) clues--; else puzzle[i] = keep;
    }
    return { puzzle: puzzle, clues: clues };
  }

  /* Создаёт головоломку. seed — число; одинаковое зерно даёт одинаковый результат. */
  function generate(diff, seed) {
    var rnd = mulberry32(seed >>> 0);
    var best = null;
    // Для сложных уровней пробуем несколько раз, чтобы головоломка
    // не решалась одними «одиночками» и была близка к целевому числу подсказок.
    var attempts = diff === 'hard' ? 8 : diff === 'expert' ? 6 : 3;
    for (var a = 0; a < attempts; a++) {
      var solution = fullGrid(rnd);
      var res = dig(solution, diff, rnd);
      var cand = { puzzle: res.puzzle, solution: solution, clues: res.clues, diff: diff };
      var target = TARGET_CLUES[diff];
      var needsMore = (diff === 'hard' || diff === 'expert') && solvableBySingles(res.puzzle);
      cand.penalty = Math.abs(res.clues - target) + (needsMore ? 3 : 0);
      if (!best || cand.penalty < best.penalty) best = cand;
      if (cand.penalty === 0) break;
    }
    delete best.penalty;
    return best;
  }

  /* 9 целей из 17 для одной игры, по возрастанию номера. */
  function pickGoals(seed) {
    var rnd = mulberry32((seed ^ 0x9E3779B9) >>> 0);
    var all = [];
    for (var i = 1; i <= 17; i++) all.push(i);
    shuffle(all, rnd);
    return all.slice(0, 9).sort(function (a, b) { return a - b; });
  }

  function dailySeed(dateKey) { return hashString('sdgoku-daily-' + dateKey); }

  /* Подсказка: какую клетку логичнее открыть при текущем (верном) состоянии поля. */
  function hintCell(grid) {
    var s = nextSingle(grid);
    if (s) return s.index;
    var bestI = -1, bestN = 10;
    for (var i = 0; i < 81; i++) {
      if (grid[i]) continue;
      var n = popcount(candidates(grid, i));
      if (n < bestN) { bestN = n; bestI = i; }
    }
    return bestI;
  }

  var api = {
    ROW: ROW, COL: COL, BOX: BOX, PEERS: PEERS,
    mulberry32: mulberry32, hashString: hashString, shuffle: shuffle,
    countSolutions: countSolutions, solve: solve, solvableBySingles: solvableBySingles,
    generate: generate, pickGoals: pickGoals, dailySeed: dailySeed, hintCell: hintCell,
    TARGET_CLUES: TARGET_CLUES
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SDGokuEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
