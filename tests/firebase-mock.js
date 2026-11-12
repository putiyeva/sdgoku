/* Заглушка Firebase (compat API) для автотестов серверного модуля: всё хранится в памяти страницы. */
window.firebase = (function () {
  var users = {}, docs = {}, current = null, listeners = [];
  function emit() { listeners.forEach(function (fn) { setTimeout(function () { fn(userObj()); }, 0); }); }
  function fail(code) { var e = new Error(code); e.code = code; return Promise.reject(e); }
  function userObj() {
    if (!current) return null;
    var me = current;
    return { uid: me.uid, email: me.email, delete: function () { delete users[me.email]; current = null; emit(); return Promise.resolve(); } };
  }
  var authObj = {
    onAuthStateChanged: function (fn) { listeners.push(fn); setTimeout(function () { fn(userObj()); }, 0); },
    signInWithEmailAndPassword: function (e, p) {
      var u = users[e];
      if (!u || u.password !== p) return fail('auth/invalid-credential');
      current = { uid: u.uid, email: e }; emit(); return Promise.resolve();
    },
    createUserWithEmailAndPassword: function (e, p) {
      if (users[e]) return fail('auth/email-already-in-use');
      users[e] = { uid: 'uid' + (Object.keys(users).length + 1), password: p };
      current = { uid: users[e].uid, email: e }; emit(); return Promise.resolve();
    },
    sendPasswordResetEmail: function () { return Promise.resolve(); },
    signOut: function () { current = null; emit(); return Promise.resolve(); }
  };
  Object.defineProperty(authObj, 'currentUser', { get: userObj });
  function settle(data, prev) {
    var out = {};
    Object.keys(data).forEach(function (k) {
      var v = data[k];
      if (v && v.__ts) out[k] = Date.now();
      else if (v && v.__union) out[k] = ((prev && prev[k]) || []).concat(v.__union.filter(function (x) { return !prev || !prev[k] || prev[k].indexOf(x) < 0; }));
      else out[k] = v;
    });
    return out;
  }
  function docRef(path) {
    return {
      get: function () { var d = docs[path]; return Promise.resolve({ exists: !!d, id: path.split('/').pop(), data: function () { return d; } }); },
      set: function (data, opts) {
        var v = settle(data, docs[path]);
        docs[path] = opts && opts.merge ? Object.assign({}, docs[path] || {}, v) : v;
        return Promise.resolve();
      },
      delete: function () { delete docs[path]; return Promise.resolve(); },
      collection: function (name) { return colRef(path + '/' + name); }
    };
  }
  function colRef(path) {
    var q = {
      _order: null, _limit: 1e9,
      doc: function (id) { return docRef(path + '/' + id); },
      orderBy: function (f) { q._order = f; return q; },
      limit: function (n) { q._limit = n; return q; },
      get: function () {
        var rows = Object.keys(docs).filter(function (k) { return k.indexOf(path + '/') === 0 && k.slice(path.length + 1).indexOf('/') < 0; })
          .map(function (k) { return { id: k.split('/').pop(), data: function () { return docs[k]; } }; });
        if (q._order) rows.sort(function (a, b) { return a.data()[q._order] - b.data()[q._order]; });
        rows = rows.slice(0, q._limit);
        return Promise.resolve({ forEach: function (fn) { rows.forEach(fn); } });
      }
    };
    return q;
  }
  var fs = function () { return { collection: colRef }; };
  fs.FieldValue = { serverTimestamp: function () { return { __ts: 1 }; }, arrayUnion: function () { return { __union: [].slice.call(arguments) }; } };
  return { apps: [], initializeApp: function (c) { this.apps.push(c); }, auth: function () { return authObj; }, firestore: fs, __docs: docs, __users: users };
})();
