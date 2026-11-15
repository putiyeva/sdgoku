/* SDGoku — серверная часть (Firebase): вход по почте, синхронизация прогресса, общий рейтинг.
   Включается, когда в js/config.js задан SDGOKU_CONFIG.firebase. Без него игра работает полностью офлайн.

   Структура данных в Firestore:
     users/{uid}                         { progress: {...}, posted: [board, ...], updatedAt }
     leaderboards/{board}/scores/{uid}   { name, score, seconds, hints, mistakes, ts }
   board: easy | medium | hard | expert | daily-ГГГГ-ММ-ДД */
(function (root) {
  'use strict';
  var Store = root.SDGokuStore;
  var cfg = (root.SDGOKU_CONFIG || {}).firebase || null;
  var state = { available: !!cfg, ready: false, user: null, syncing: false, syncError: false, lastSync: 0 };
  var listeners = [];
  var fb = null, auth = null, db = null;

  function emit() { listeners.forEach(function (fn) { try { fn(state); } catch (e) { /* ignore */ } }); }
  function clean(obj) { return JSON.parse(JSON.stringify(obj)); }
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Cannot load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function init() {
    if (!cfg) return Promise.resolve(false);
    var ready = root.firebase ? Promise.resolve() :
      loadScript('vendor/firebase-app-compat.js')
        .then(function () { return loadScript('vendor/firebase-auth-compat.js'); })
        .then(function () { return loadScript('vendor/firebase-firestore-compat.js'); });
    return ready.then(function () {
      fb = root.firebase;
      if (!fb.apps || !fb.apps.length) fb.initializeApp(cfg);
      auth = fb.auth();
      db = fb.firestore();
      auth.onAuthStateChanged(function (u) {
        state.user = u ? { uid: u.uid, email: u.email || '' } : null;
        state.ready = true;
        emit();
        if (u) sync();
      });
      return true;
    }).catch(function () {
      state.available = false;
      emit();
      return false;
    });
  }

  function errorKey(e) {
    var code = (e && e.code) || '';
    if (code === 'auth/invalid-email' || code === 'auth/missing-email') return 'err_email';
    if (code === 'auth/weak-password' || code === 'auth/missing-password') return 'err_password';
    if (code === 'auth/wrong-password' || code === 'auth/user-not-found' ||
        code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') return 'err_wrong';
    if (code === 'auth/email-already-in-use') return 'err_exists';
    if (code === 'auth/network-request-failed' || code === 'unavailable') return 'err_network';
    if (code === 'auth/requires-recent-login') return 'err_relogin';
    return 'err_generic';
  }
  function wrap(promise) {
    return promise.then(function () { return { ok: true }; })
      .catch(function (e) { return { ok: false, error: errorKey(e) }; });
  }

  function signIn(email, password) { return wrap(auth.signInWithEmailAndPassword(email, password)); }
  function signUp(email, password) { return wrap(auth.createUserWithEmailAndPassword(email, password)); }
  function resetPassword(email) { return wrap(auth.sendPasswordResetEmail(email)); }
  function signOut() { return wrap(auth.signOut()); }

  /* Скачать прогресс с сервера, объединить с локальным, отправить результат обратно. */
  function sync() {
    if (!state.user || !db) return Promise.resolve(false);
    state.syncing = true; emit();
    var ref = db.collection('users').doc(state.user.uid);
    return ref.get().then(function (snap) {
      if (snap.exists) {
        var remote = snap.data() || {};
        if (remote.progress) Store.mergeProgress(remote.progress);
      }
      return ref.set({
        progress: clean(Store.exportProgress()),
        updatedAt: fb.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }).then(function () {
      state.syncing = false; state.syncError = false; state.lastSync = Date.now(); emit();
      return true;
    }).catch(function () {
      state.syncing = false; state.syncError = true; emit();
      return false;
    });
  }

  /* Отправить результат в общий рейтинг (сохраняется только лучший результат игрока на доске).
     Если результат не лучше прежнего, но имя игрока изменилось, обновляется только имя. */
  function submitScore(board, entry, name) {
    if (!state.user || !db) return Promise.resolve(false);
    var uid = state.user.uid;
    var ref = db.collection('leaderboards').doc(board).collection('scores').doc(uid);
    return ref.get().then(function (snap) {
      if (snap.exists && snap.data().score <= entry.score) {
        var newName = String(name || '').slice(0, 20);
        if (newName && snap.data().name !== newName) {
          return ref.update({ name: newName }).then(function () { return true; });
        }
        return false;
      }
      return ref.set({
        name: String(name || '').slice(0, 20),
        score: entry.score, seconds: entry.seconds, hints: entry.hints, mistakes: entry.mistakes,
        ts: fb.firestore.FieldValue.serverTimestamp()
      }).then(function () {
        return db.collection('users').doc(uid).set(
          { posted: fb.firestore.FieldValue.arrayUnion(board) }, { merge: true });
      }).then(function () { return true; });
    }).catch(function () { return false; });
  }

  /* Обновить имя игрока на всех досках, где у него уже есть результат. */
  function updateName(name) {
    if (!state.user || !db) return Promise.resolve(false);
    var uid = state.user.uid;
    var newName = String(name || '').slice(0, 20);
    if (!newName) return Promise.resolve(false);
    return db.collection('users').doc(uid).get().then(function (snap) {
      var posted = (snap.exists && snap.data().posted) || [];
      return Promise.all(posted.map(function (board) {
        return db.collection('leaderboards').doc(board).collection('scores').doc(uid)
          .update({ name: newName }).catch(function () { return null; });
      }));
    }).then(function () { return true; }).catch(function () { return false; });
  }

  function fetchTop(board, limit) {
    if (!db) return Promise.reject(new Error('offline'));
    return db.collection('leaderboards').doc(board).collection('scores')
      .orderBy('score', 'asc').limit(limit || 50).get()
      .then(function (snap) {
        var rows = [];
        snap.forEach(function (doc) {
          var d = doc.data();
          rows.push({ uid: doc.id, name: d.name || '', score: d.score, seconds: d.seconds, hints: d.hints || 0 });
        });
        return rows;
      });
  }

  /* Полное удаление аккаунта и данных (требование App Store и Google Play). */
  function deleteAccount() {
    if (!state.user || !db) return Promise.resolve({ ok: false, error: 'err_generic' });
    var uid = state.user.uid;
    var userRef = db.collection('users').doc(uid);
    return wrap(userRef.get().then(function (snap) {
      var posted = (snap.exists && snap.data().posted) || [];
      return Promise.all(posted.map(function (board) {
        return db.collection('leaderboards').doc(board).collection('scores').doc(uid).delete();
      }));
    }).then(function () { return userRef.delete(); })
      .then(function () { return auth.currentUser.delete(); }));
  }

  root.SDGokuCloud = {
    state: state, init: init,
    onChange: function (fn) { listeners.push(fn); },
    signIn: signIn, signUp: signUp, resetPassword: resetPassword, signOut: signOut,
    sync: sync, submitScore: submitScore, updateName: updateName, fetchTop: fetchTop, deleteAccount: deleteAccount
  };
})(window);
