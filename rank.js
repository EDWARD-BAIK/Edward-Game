(function () {
  var STORE = 'edward_rank';
  var DIST_PER_POINT = 20;
  var HARD_BONUS = 1.5;
  var WIB = 7 * 3600 * 1000;
  var MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  var TIERS = [
    { name: 'Rekrut', min: 0, a: '#b6aa98', b: '#5c5346', c: '#2a251f' },
    { name: 'Penjelajah', min: 100, a: '#f0b27a', b: '#a05a28', c: '#4a2610' },
    { name: 'Pengembara', min: 300, a: '#eef2f8', b: '#8793a8', c: '#363e4e' },
    { name: 'Pemburu', min: 700, a: '#ffe08a', b: '#d29114', c: '#6b4306' },
    { name: 'Kesatria', min: 1300, a: '#7af0d8', b: '#14998a', c: '#064a42' },
    { name: 'Penjaga Dimensi', min: 2200, a: '#85c8ff', b: '#2b66d6', c: '#0f2a6b' },
    { name: 'Penakluk', min: 3500, a: '#c9a6ff', b: '#7440de', c: '#33157a' },
    { name: 'Legenda', min: 5500, a: '#ff9ad2', b: '#cc2a86', c: '#640f42' },
    { name: 'Titan', min: 8500, a: '#ffb067', b: '#e03a1e', c: '#6e1208' },
    { name: 'Penguasa Dimensi', min: 13000, a: '#fff6bd', b: '#ffb300', c: '#7a4a00' }
  ];

  function el(id) { return document.getElementById(id); }

  function monthKey() {
    return new Date(Date.now() + WIB).toISOString().slice(0, 7);
  }

  function tierIndex(points) {
    var i = 0;
    for (var k = 0; k < TIERS.length; k++) if (points >= TIERS[k].min) i = k;
    return i;
  }

  function load() {
    var key = monthKey();
    var s = null;
    try { s = JSON.parse(localStorage.getItem(STORE)); } catch (e) {}
    if (!s || typeof s.p !== 'number' || s.p < 0) s = { m: key, p: 0, l: 0 };
    if (s.m !== key) s = { m: key, p: 0, l: s.p > 0 ? tierIndex(s.p) + 1 : 0 };
    s.p = Math.floor(s.p);
    return s;
  }

  function save(s) {
    try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) {}
  }

  function star(cx, cy, R, r) {
    var pts = [];
    for (var i = 0; i < 10; i++) {
      var rad = i % 2 === 0 ? R : r;
      var ang = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push((cx + rad * Math.cos(ang)).toFixed(2) + ',' + (cy + rad * Math.sin(ang)).toFixed(2));
    }
    return '<polygon points="' + pts.join(' ') + '"/>';
  }

  function emblem(t) {
    var f = '#fff8e8';
    var chev = 'M22 30 L32 24 L42 30 L42 34 L32 28 L22 34 Z';
    var out = '';
    if (t <= 3) {
      var off = -(t - 1) * 3.5;
      for (var i = 0; i < t; i++) {
        out += '<path d="' + chev + '" transform="translate(0 ' + (off + i * 7) + ')"/>';
      }
      return '<g fill="' + f + '">' + out + '</g>';
    }
    if (t === 4) return '<g fill="' + f + '">' + star(32, 34, 12, 5) + '</g>';
    if (t === 5) return '<g fill="' + f + '">' + star(32, 37, 9.5, 4) + star(23, 24, 3.6, 1.6) + star(41, 24, 3.6, 1.6) + '</g>';
    if (t === 6 || t === 7) {
      var g = '<path d="M32 21 L43 31 L32 47 L21 31 Z" fill="' + f + '"/>' +
        '<path d="M21 31 H43 M32 21 L27.5 31 L32 47 M32 21 L36.5 31 L32 47" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="1.1" stroke-linejoin="round"/>';
      if (t === 7) g += '<circle cx="32" cy="34" r="16" fill="none" stroke="' + f + '" stroke-width="1.4" stroke-dasharray="2.5 3.2" opacity=".85"/>';
      return g;
    }
    var crown = '<path d="M20 41 L20 25 L27 32 L32 21 L37 32 L44 25 L44 41 Z" fill="' + f + '"/>' +
      '<path d="M20 43 H44 V46 H20 Z" fill="' + f + '"/>';
    if (t === 8) return crown + '<circle cx="27" cy="37" r="1.7" fill="rgba(0,0,0,.35)"/><circle cx="37" cy="37" r="1.7" fill="rgba(0,0,0,.35)"/>';
    if (t === 9) return crown + '<circle cx="32" cy="35" r="3.2" fill="#e0301e"/><circle cx="20" cy="25" r="2" fill="' + f + '"/><circle cx="32" cy="21" r="2" fill="' + f + '"/><circle cx="44" cy="25" r="2" fill="' + f + '"/>';
    return crown + '<path d="M32 28 L36 34 L32 42 L28 34 Z" fill="#35d0ff" stroke="rgba(0,0,0,.3)" stroke-width=".8"/>' +
      '<circle cx="20" cy="25" r="2" fill="' + f + '"/><circle cx="32" cy="21" r="2" fill="' + f + '"/><circle cx="44" cy="25" r="2" fill="' + f + '"/>';
  }

  function badge(t, size) {
    var c = TIERS[t - 1];
    var p = 'rk' + t;
    var shield = 'M32 6 L52 13 V32 C52 45 43 54 32 59 C21 54 12 45 12 32 V13 Z';
    var wingS = 'M13 18 L2 13 L6 23 L0 26 L7 33 L3 39 L12 40 Z';
    var wingL = 'M13 16 L1 6 L5 18 L-3 20 L4 29 L-2 35 L6 38 L3 46 L13 42 Z';
    var s = '<svg class="rank-svg" width="' + size + '" height="' + size + '" viewBox="-4 -2 72 68" role="img" aria-label="' + c.name + '">';
    s += '<defs>' +
      '<linearGradient id="' + p + 'a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c.a + '"/><stop offset="1" stop-color="' + c.b + '"/></linearGradient>' +
      '<linearGradient id="' + p + 'b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c.b + '"/><stop offset="1" stop-color="' + c.c + '"/></linearGradient>' +
      '<radialGradient id="' + p + 'g" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="' + c.a + '" stop-opacity=".55"/><stop offset="1" stop-color="' + c.a + '" stop-opacity="0"/></radialGradient>' +
      '</defs>';
    if (t >= 7) s += '<circle cx="32" cy="33" r="31" fill="url(#' + p + 'g)"/>';
    if (t >= 4) {
      var w = t >= 8 ? wingL : wingS;
      s += '<g fill="url(#' + p + 'a)" stroke="' + c.c + '" stroke-width="1.4" stroke-linejoin="round">' +
        '<path d="' + w + '"/><path d="' + w + '" transform="translate(64 0) scale(-1 1)"/></g>';
    }
    if (t === 10) s += '<circle cx="32" cy="33" r="30" fill="none" stroke="' + c.a + '" stroke-width="1.2" stroke-dasharray="1.5 3" opacity=".9"/>';
    s += '<path d="' + shield + '" fill="url(#' + p + 'a)" stroke="' + c.c + '" stroke-width="2.2" stroke-linejoin="round"/>';
    s += '<path d="' + shield + '" transform="translate(32 33) scale(.76) translate(-32 -33)" fill="url(#' + p + 'b)" stroke="rgba(255,255,255,.55)" stroke-width="1.3" stroke-linejoin="round"/>';
    s += '<path d="M32 6 L52 13 V27 C42 23 22 23 12 27 V13 Z" fill="#fff" opacity=".16"/>';
    s += emblem(t);
    if (t === 10) s += '<g fill="' + c.a + '" stroke="' + c.c + '" stroke-width=".8">' + star(32, 5.5, 4.4, 1.9) + '</g>';
    return s + '</svg>';
  }

  function nextReset() {
    var n = new Date(Date.now() + WIB);
    var end = Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 1);
    var ms = end - n.getTime();
    var days = Math.floor(ms / 86400000);
    var hours = Math.floor((ms % 86400000) / 3600000);
    return { days: days, hours: hours, month: MONTHS[(n.getUTCMonth() + 1) % 12] };
  }

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  function renderChip() {
    var chip = el('rankChip');
    if (!chip) return;
    var s = load();
    var i = tierIndex(s.p);
    chip.innerHTML = badge(i + 1, 28) + '<span class="rank-chip-text"><b>' + TIERS[i].name + '</b><small>' + fmt(s.p) + ' poin</small></span>';
  }

  function renderModal() {
    var s = load();
    var i = tierIndex(s.p);
    var cur = TIERS[i];
    var nxt = TIERS[i + 1];
    var pct = nxt ? Math.min(100, ((s.p - cur.min) / (nxt.min - cur.min)) * 100) : 100;
    var r = nextReset();
    var h = '<div class="rank-hero">' +
      '<div class="rank-hero-badge">' + badge(i + 1, 104) + '</div>' +
      '<div class="rank-hero-name">' + cur.name + '</div>' +
      '<div class="rank-hero-pts">' + fmt(s.p) + ' poin</div>' +
      '<div class="rank-bar"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
      '<div class="rank-hero-next">' + (nxt ? fmt(nxt.min - s.p) + ' poin lagi menuju ' + nxt.name : 'Rank tertinggi tercapai') + '</div>' +
      '</div>';
    h += '<div class="rank-list">';
    for (var k = TIERS.length - 1; k >= 0; k--) {
      var t = TIERS[k];
      var cls = k === i ? 'now' : k < i ? 'done' : 'lock';
      var hi = TIERS[k + 1] ? ' - ' + fmt(TIERS[k + 1].min - 1) : '+';
      h += '<div class="rank-row ' + cls + '">' + badge(k + 1, 46) +
        '<div class="rank-row-info"><b>' + t.name + '</b><small>' + fmt(t.min) + hi + ' poin</small></div>' +
        '<span class="rank-row-tag">' + (k === i ? 'KAMU' : k < i ? '✓' : '🔒') + '</span></div>';
    }
    h += '</div>';
    h += '<div class="rank-info">Poin bertambah setelah tiap ronde: 1 poin per ' + DIST_PER_POINT + ' meter jarak tempuh, mode Sulit x' + HARD_BONUS + '.</div>';
    h += '<div class="rank-info">⏰ Rank direset ke awal setiap tanggal 1 pukul 00:00 WIB. Reset ' + r.month + ' dalam ' + r.days + ' hari ' + r.hours + ' jam.</div>';
    if (s.l > 0) h += '<div class="rank-info">Rank akhir bulan lalu: <b>' + TIERS[s.l - 1].name + '</b></div>';
    el('rankBody').innerHTML = h;
  }

  function finishRun(distance, mode) {
    var d = Math.floor(Number(distance));
    var box = el('rankGain');
    if (!Number.isFinite(d) || d < 0) d = 0;
    var gain = Math.floor(d / DIST_PER_POINT);
    if (mode === 'hard') gain = Math.floor(gain * HARD_BONUS);
    var s = load();
    var before = tierIndex(s.p);
    s.p += gain;
    save(s);
    var after = tierIndex(s.p);
    renderChip();
    if (!box) return;
    var h = '<div class="rank-gain-row"><span class="rank-gain-pts">+' + fmt(gain) + ' poin</span><span class="rank-gain-total">' + fmt(s.p) + ' total</span></div>';
    if (after > before) h += '<div class="rank-up">' + badge(after + 1, 38) + '<span>NAIK RANK<br><b>' + TIERS[after].name + '</b></span></div>';
    else h += '<div class="rank-gain-cur">' + badge(after + 1, 26) + '<span>' + TIERS[after].name + '</span></div>';
    box.innerHTML = h;
    box.style.display = 'block';
  }

  function open() {
    renderModal();
    el('rankModal').style.display = 'flex';
  }

  function close() {
    el('rankModal').style.display = 'none';
  }

  function esc(v) {
    return String(v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function sync(r) {
    if (!r || typeof r.p !== 'number' || r.p < 0) return;
    var s = load();
    s.p = Math.floor(r.p);
    save(s);
    renderChip();
    var tot = document.querySelector('#rankGain .rank-gain-total');
    if (tot) tot.textContent = fmt(s.p) + ' total';
  }

  function mini(points) {
    if (typeof points !== 'number') return '';
    var i = tierIndex(points);
    return '<span class="lb-rk" title="' + TIERS[i].name + '">' + badge(i + 1, 26) + '</span>';
  }

  function rpc(fn, args) {
    return window.sbRpc ? window.sbRpc(fn, args) : Promise.reject(new Error('offline'));
  }

  function lookup(names) {
    var list = names.filter(Boolean).slice(0, 50);
    if (!list.length) return Promise.resolve({});
    return rpc('rank_lookup', { p_names: list }).then(function (rows) {
      var map = {};
      (Array.isArray(rows) ? rows : []).forEach(function (r) { map[r.name] = r.points; });
      return map;
    });
  }

  function hideRankTab() {
    var box = el('rankLbList');
    var tab = el('tabRankBtn');
    if (box) box.style.display = 'none';
    if (tab) tab.classList.remove('selected');
  }

  function showRankTab() {
    ['tabMyScoreBtn', 'tabOnlineBtn'].forEach(function (id) { el(id).classList.remove('selected'); });
    el('tabRankBtn').classList.add('selected');
    el('leaderboardList').style.display = 'none';
    el('onlineLeaderboardList').style.display = 'none';
    el('onlineLeaderboardHint').style.display = 'none';
    var box = el('rankLbList');
    box.style.display = 'block';
    box.innerHTML = '<div class="empty-hint">Memuat...</div>';
    var me = typeof playerName === 'string' ? playerName : '';
    rpc('rank_top', {}).then(function (rows) {
      rows = Array.isArray(rows) ? rows : [];
      var r = nextReset();
      var h = '<div class="rank-lb-hint">Top 50 rank bulan ini. Direset ' + r.days + ' hari ' + r.hours + ' jam lagi.</div>';
      if (!rows.length) h += '<div class="empty-hint">Belum ada yang punya poin bulan ini. Jadilah yang pertama!</div>';
      h += rows.map(function (row, i) {
        var t = tierIndex(row.points);
        var pos = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';
        return '<div class="lb-row' + (row.name === me ? ' me-row' : '') + '">' +
          '<div class="lb-rank ' + pos + '">' + (i + 1) + '</div>' +
          '<span class="lb-rk">' + badge(t + 1, 32) + '</span>' +
          '<div class="lb-name">' + esc(row.name) + '<small class="lb-tier">' + TIERS[t].name + '</small></div>' +
          '<div class="lb-dist">' + fmt(row.points) + '</div></div>';
      }).join('');
      box.innerHTML = h;
    }).catch(function () {
      box.innerHTML = '<div class="empty-hint">Gagal memuat rank global. Cek koneksi internet.</div>';
    });
  }

  function init() {
    renderChip();
    var chip = el('rankChip');
    if (chip) chip.addEventListener('click', open);
    var x = el('closeRankBtn');
    if (x) x.addEventListener('click', close);
    var tab = el('tabRankBtn');
    if (tab) tab.addEventListener('click', showRankTab);
    ['tabMyScoreBtn', 'tabOnlineBtn', 'openLeaderboardBtn'].forEach(function (id) {
      var b = el(id);
      if (b) b.addEventListener('click', hideRankTab);
    });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) renderChip(); });
  }

  window.EdwardRank = { finishRun: finishRun, render: renderChip, badge: badge, tiers: TIERS, sync: sync, mini: mini, lookup: lookup };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
