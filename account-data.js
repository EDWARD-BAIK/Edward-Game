(function () {
  try {
    var LS = window.localStorage, i, k;
    var KEYS = [
      'edward_total_coins', 'edward_owned_skins', 'edward_selected_skin', 'edward_high_dist',
      'edward_leaderboard', 'edward_stats', 'edward_achievements', 'edward_daily',
      'edward_player_name', 'edward_name_claimed', 'edward_name_claim_day',
      'edward_dimension_mode', 'edward_online_players', 'edward_rank'
    ];

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

    function snapshot(id) {
      var snap = {};
      KEYS.forEach(function (key) { var val = LS.getItem(key); if (val != null) snap[key] = val; });
      LS.setItem('edw_snap_' + id, JSON.stringify(snap));
    }
    function wipe() {
      KEYS.forEach(function (key) { LS.removeItem(key); });
      LS.removeItem('edw_dirty');
    }

    LS.removeItem('edw_snap_guest');
    LS.removeItem('edw_claimed');

    if (target === 'guest') {
      if (active !== 'guest') snapshot(active);
      wipe();
      LS.setItem('edw_active', 'guest');
      return;
    }

    if (target === active) return;

    if (active !== 'guest') snapshot(active);
    wipe();
    var next = LS.getItem('edw_snap_' + target);
    if (next) {
      try {
        var data = JSON.parse(next);
        KEYS.forEach(function (key) { if (data[key] != null) LS.setItem(key, data[key]); });
      } catch (e) {}
    }
    LS.setItem('edw_active', target);
  } catch (e) {}
})();
