(function () {
  try {
    var LS = window.localStorage, PRE = 'edward_', i, k;

    var uid = null;
    for (i = 0; i < LS.length; i++) {
      k = LS.key(i);
      if (/^sb-.+-auth-token$/.test(k)) {
        try {
          var v = JSON.parse(LS.getItem(k));
          var s = (v && v.currentSession) || v;
          if (s && s.user && s.user.id) uid = s.user.id;
        } catch (e) {}
      }
    }

    var target = uid || 'guest';
    var active = LS.getItem('edw_active') || 'guest';
    if (target === active) {
      if (!LS.getItem('edw_active')) LS.setItem('edw_active', active);
      return;
    }

    var keys = [], snap = {};
    for (i = 0; i < LS.length; i++) { k = LS.key(i); if (k.indexOf(PRE) === 0) keys.push(k); }
    keys.forEach(function (key) { snap[key] = LS.getItem(key); });
    LS.setItem('edw_snap_' + active, JSON.stringify(snap));

    var firstLogin = target !== 'guest' && active === 'guest' && !LS.getItem('edw_claimed');
    if (firstLogin) {
      LS.setItem('edw_claimed', '1');
      LS.removeItem('edw_snap_guest');
    } else {
      keys.forEach(function (key) { LS.removeItem(key); });
      var next = LS.getItem('edw_snap_' + target);
      if (next) {
        try {
          var data = JSON.parse(next);
          Object.keys(data).forEach(function (key) { if (data[key] != null) LS.setItem(key, data[key]); });
        } catch (e) {}
      }
    }
    LS.setItem('edw_active', target);
  } catch (e) {}
})();
