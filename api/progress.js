import { guard, body, authUser, readToken, ipHash, allow, sb, MAX_SPEED, TOKEN_TTL_MS, MAX_DIST, isBanned, fail, dayJakarta } from './_lib.js';
import { SKINS } from './_skins.js';

const LEGACY_ON = process.env.LEGACY_IMPORT !== '0';
const LEGACY_BEFORE = Date.parse(process.env.LEGACY_BEFORE || '2026-10-19T00:00:00Z');
const LEGACY_MAX_COINS = Number(process.env.LEGACY_MAX_COINS || 20000);
const LEGACY_MAX_DIST = Number(process.env.LEGACY_MAX_DIST || 30000);
const COIN_CEIL = 1000000000;
const MP_WINS_PER_DAY = 10;
const RANK_METERS_PER_POINT = 20;
const RANK_HARD_BONUS = 1.5;

function rankGain(dist, mode) {
  const base = Math.floor(dist / RANK_METERS_PER_POINT);
  return mode === 'hard' ? Math.floor(base * RANK_HARD_BONUS) : base;
}

function rankMonth() {
  return dayJakarta().slice(0, 7);
}

const ACH = [
  { id: 'first_steps', reward: 20, ok: c => c.best >= 100 },
  { id: 'marathon_500', reward: 50, ok: c => c.best >= 500 },
  { id: 'marathon_1000', reward: 100, ok: c => c.best >= 1000 },
  { id: 'coin_collector', reward: 50, ok: c => c.stats.totalCoins >= 500 },
  { id: 'enemy_slayer', reward: 80, ok: c => c.stats.totalKills >= 50 },
  { id: 'skin_collector', reward: 100, ok: c => c.skins >= 5 },
  { id: 'multiplayer_win', reward: 60, ok: c => c.stats.totalMpWins >= 1 },
  { id: 'hardcore', reward: 70, ok: c => c.hard >= 300 },
  { id: 'dedicated', reward: 40, ok: c => c.stats.totalGames >= 10 }
];

const POOL = [
  { id: 'coins100', target: 100, reward: 30, key: 'coinsToday' },
  { id: 'dist500', target: 500, reward: 40, key: 'distanceToday' },
  { id: 'kills5', target: 5, reward: 30, key: 'killsToday' },
  { id: 'games3', target: 3, reward: 25, key: 'gamesToday' },
  { id: 'mpwin1', target: 1, reward: 50, key: 'mpWinsToday' }
];

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function dateSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}
function pick3(seed) {
  const rr = mulberry32(seed >>> 0);
  const arr = POOL.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rr() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, 3);
}
function freshDaily(day) {
  return {
    date: day, coinsToday: 0, distanceToday: 0, killsToday: 0, gamesToday: 0, mpWinsToday: 0,
    missions: pick3(dateSeed(day)).map(m => ({ id: m.id, progress: 0, claimed: false }))
  };
}
function rolled(daily, day) {
  return (daily && daily.date === day && Array.isArray(daily.missions)) ? daily : freshDaily(day);
}
function baseStats(s) {
  const o = s && typeof s === 'object' ? s : {};
  const n = k => (Number.isFinite(o[k]) && o[k] > 0) ? Math.floor(o[k]) : 0;
  return { totalDistance: n('totalDistance'), totalCoins: n('totalCoins'), totalKills: n('totalKills'), totalGames: n('totalGames'), totalMpWins: n('totalMpWins') };
}

function view(r) {
  const day = dayJakarta();
  return {
    coins: r.coins,
    skins: r.owned_skins,
    selected: r.selected_skin,
    high: Math.max(r.high_normal, r.high_hard),
    ach: r.achievements,
    stats: baseStats(r.stats),
    daily: rolled(r.daily, day)
  };
}

async function loadRow(uid) {
  for (let i = 0; i < 3; i++) {
    const sel = await sb.from('player_progress').select('*').eq('user_id', uid).maybeSingle();
    if (sel.error) throw sel.error;
    if (sel.data) return sel.data;
    const ins = await sb.from('player_progress').insert({ user_id: uid }).select('*').maybeSingle();
    if (ins.error && ins.error.code !== '23505') throw ins.error;
    if (ins.data) return ins.data;
  }
  throw new Error('row');
}

async function mutate(uid, fn) {
  for (let i = 0; i < 4; i++) {
    const row = await loadRow(uid);
    const out = fn(row);
    if (out.error) return out;
    const patch = Object.assign({}, out.patch, { version: row.version + 1 });
    const up = await sb.from('player_progress').update(patch).eq('user_id', uid).eq('version', row.version).select('*');
    if (up.error) throw up.error;
    if (up.data && up.data.length) return { row: up.data[0], extra: out.extra };
  }
  throw new Error('busy');
}

function settle(row, patch, granted) {
  const day = dayJakarta();
  const daily = rolled(patch.daily || row.daily, day);
  const stats = baseStats(patch.stats || row.stats);
  const owned = patch.owned_skins || row.owned_skins;
  const hn = patch.high_normal != null ? patch.high_normal : row.high_normal;
  const hh = patch.high_hard != null ? patch.high_hard : row.high_hard;
  let coins = patch.coins != null ? patch.coins : row.coins;
  const ach = (patch.achievements || row.achievements).slice();

  daily.missions.forEach(m => {
    const def = POOL.find(p => p.id === m.id);
    if (!def) return;
    m.progress = Math.min(def.target, daily[def.key] || 0);
    if (!m.claimed && m.progress >= def.target) {
      m.claimed = true;
      coins += def.reward;
      granted.daily.push({ id: def.id, reward: def.reward });
    }
  });
  const ctx = { best: Math.max(hn, hh), hard: hh, stats: stats, skins: owned.length };
  ACH.forEach(a => {
    if (!ach.includes(a.id) && a.ok(ctx)) {
      ach.push(a.id);
      coins += a.reward;
      granted.ach.push({ id: a.id, reward: a.reward });
    }
  });
  return Object.assign({}, patch, { coins: Math.min(coins, COIN_CEIL), daily: daily, stats: stats, achievements: ach });
}

function parseLegacy(row, src) {
  const d = row.data || {};
  let l = null;
  if (d.edward_total_coins != null || d.edward_owned_skins != null || d.edward_high_dist != null) {
    const j = k => { try { return JSON.parse(d[k]); } catch (e) { return null; } };
    l = { coins: Number(d.edward_total_coins), skins: j('edward_owned_skins'), sel: d.edward_selected_skin, high: Number(d.edward_high_dist), ach: j('edward_achievements'), stats: j('edward_stats') };
  } else if (src && typeof src === 'object') {
    l = src;
  }
  return l;
}

function legacyPatch(l) {
  const num = (v, max) => (Number.isFinite(Number(v)) && Number(v) > 0) ? Math.min(Math.floor(Number(v)), max) : 0;
  const skins = ['default'];
  (Array.isArray(l.skins) ? l.skins : []).forEach(s => {
    if (typeof s === 'string' && Object.prototype.hasOwnProperty.call(SKINS, s) && !skins.includes(s)) skins.push(s);
  });
  const sel = skins.includes(l.sel) ? l.sel : 'default';
  const known = ACH.map(a => a.id);
  const ach = [];
  (Array.isArray(l.ach) ? l.ach : []).forEach(a => { if (known.includes(a) && !ach.includes(a)) ach.push(a); });
  const st = l.stats && typeof l.stats === 'object' ? l.stats : {};
  return {
    coins: num(l.coins, LEGACY_MAX_COINS),
    owned_skins: skins,
    selected_skin: sel,
    high_normal: num(l.high, LEGACY_MAX_DIST),
    achievements: ach,
    stats: {
      totalDistance: num(st.totalDistance, 100000000),
      totalCoins: num(st.totalCoins, 100000000),
      totalKills: num(st.totalKills, 1000000),
      totalGames: num(st.totalGames, 1000000),
      totalMpWins: num(st.totalMpWins, 100000)
    }
  };
}

export default async function handler(req, res) {
  if (!guard(req, res, 8192)) return;
  try {
    const b = body(req);
    const ip = ipHash(req);
    if (!(await allow('prog:ip:' + ip, 120, 60))) return res.status(429).json({ ok: false, reason: 'rate' });

    const u = await authUser(req);
    if (!u) return res.status(401).json({ ok: false, reason: 'login' });
    const uid = u.id;
    if (!(await allow('prog:id:' + uid, 30, 60))) return res.status(429).json({ ok: false, reason: 'rate' });

    const act = String(b.action || '');
    const legacyOk = LEGACY_ON && !!u.created && Date.parse(u.created) < LEGACY_BEFORE;
    const granted = { ach: [], daily: [] };

    if (act === 'load') {
      let row = await loadRow(uid);
      if (!row.initialized) {
        const out = await mutate(uid, r => {
          if (r.initialized) return { patch: {} };
          let patch = { initialized: true };
          const l = legacyOk ? parseLegacy(r, b.legacy) : null;
          if (l) {
            patch = Object.assign(legacyPatch(l), patch);
            patch.coins = Math.min(patch.coins + r.coins, COIN_CEIL);
          }
          return { patch: patch };
        });
        row = out.row;
      }
      const nm = await sb.from('player_names').select('name').eq('id', uid).maybeSingle();
      const st = view(row);
      st.name = (nm.data && nm.data.name) || '';
      let rank = null;
      try {
        const rk = await sb.rpc('rank_me', { p_user: uid });
        if (!rk.error && typeof rk.data === 'number') rank = { m: rankMonth(), p: rk.data };
      } catch (e) {}
      return res.status(200).json({ ok: true, state: st, granted: granted, rank: rank });
    }

    if (act === 'buy') {
      const skin = String(b.skin || '');
      if (!Object.prototype.hasOwnProperty.call(SKINS, skin)) return res.status(400).json({ ok: false, reason: 'skin' });
      const out = await mutate(uid, r => {
        if (r.owned_skins.includes(skin)) return { error: 'owned' };
        const price = SKINS[skin];
        if (r.coins < price) return { error: 'coins' };
        const patch = {
          coins: r.coins - price,
          owned_skins: r.owned_skins.concat([skin]),
          selected_skin: skin
        };
        return { patch: settle(r, patch, granted) };
      });
      if (out.error) return res.status(200).json({ ok: false, reason: out.error });
      return res.status(200).json({ ok: true, state: view(out.row), granted: granted });
    }

    if (act === 'select') {
      const skin = String(b.skin || '');
      const out = await mutate(uid, r => {
        if (!r.owned_skins.includes(skin)) return { error: 'notowned' };
        return { patch: { selected_skin: skin } };
      });
      if (out.error) return res.status(200).json({ ok: false, reason: out.error, state: view(await loadRow(uid)) });
      return res.status(200).json({ ok: true, state: view(out.row), granted: granted });
    }

    if (act === 'mpwin') {
      if (!(await allow('mpwin:id:' + uid, 1, 60))) return res.status(429).json({ ok: false, reason: 'rate' });
      const out = await mutate(uid, r => {
        const daily = rolled(r.daily, dayJakarta());
        if (daily.mpWinsToday >= MP_WINS_PER_DAY) return { error: 'limit' };
        daily.mpWinsToday += 1;
        const stats = baseStats(r.stats);
        stats.totalMpWins += 1;
        return { patch: settle(r, { daily: daily, stats: stats }, granted) };
      });
      if (out.error) return res.status(200).json({ ok: false, reason: out.error });
      return res.status(200).json({ ok: true, state: view(out.row), granted: granted });
    }

    if (act === 'run') {
      const t = readToken(b.token);
      if (!t || t.i !== uid) return res.status(403).json({ ok: false, reason: 'token' });
      if (await isBanned(uid, ip)) return res.status(403).json({ ok: false, reason: 'banned' });
      const elapsedMs = Date.now() - t.t;
      if (elapsedMs < 0 || elapsedMs > TOKEN_TTL_MS) return res.status(403).json({ ok: false, reason: 'expired' });
      if (!(await allow('run:id:' + uid, 1, 5))) return res.status(429).json({ ok: false, reason: 'rate' });

      const d = Math.floor(Number(b.dist));
      if (!Number.isFinite(d) || d < 0 || d > MAX_DIST) return res.status(400).json({ ok: false, reason: 'dist' });
      const maxPossible = (elapsedMs / 1000) * MAX_SPEED + 20;
      if (d > maxPossible) return res.status(400).json({ ok: false, reason: 'impossible' });

      const walletCap = d + 60 + 100 * Math.floor(d / 500);
      const killsCap = Math.floor(d / 8) + 5;
      const clampN = (v, max) => { const n = Math.floor(Number(v)); return (Number.isFinite(n) && n > 0) ? Math.min(n, max) : 0; };
      const wallet = clampN(b.wallet, walletCap);
      const kills = clampN(b.kills, killsCap);
      const runCoins = clampN(b.coins, walletCap + 15 * kills);
      const mode = t.m === 'hard' ? 'hard' : 'normal';

      const nonce = 'r:' + t.n;
      const ins = await sb.from('used_nonces').insert({ nonce: nonce });
      if (ins.error) {
        if (ins.error.code === '23505') return res.status(403).json({ ok: false, reason: 'replay' });
        throw ins.error;
      }
      let out;
      try {
        out = await mutate(uid, r => {
          const daily = rolled(r.daily, dayJakarta());
          daily.coinsToday += runCoins;
          daily.distanceToday += d;
          daily.killsToday += kills;
          daily.gamesToday += 1;
          const stats = baseStats(r.stats);
          stats.totalDistance += d;
          stats.totalCoins += runCoins;
          stats.totalKills += kills;
          stats.totalGames += 1;
          const patch = {
            coins: Math.min(r.coins + wallet, COIN_CEIL),
            daily: daily,
            stats: stats,
            high_normal: mode === 'normal' ? Math.max(r.high_normal, d) : r.high_normal,
            high_hard: mode === 'hard' ? Math.max(r.high_hard, d) : r.high_hard
          };
          return { patch: settle(r, patch, granted) };
        });
      } catch (e) {
        try { await sb.from('used_nonces').delete().eq('nonce', nonce); } catch (e2) {}
        throw e;
      }
      let rank = null;
      try {
        const add = await sb.rpc('rank_add', { p_user: uid, p_points: rankGain(d, mode) });
        if (add.error) console.error('rank_add', add.error);
        else rank = { m: rankMonth(), p: add.data };
      } catch (e) {
        console.error('rank_add', e);
      }
      return res.status(200).json({ ok: true, state: view(out.row), granted: granted, rank: rank });
    }

    if (act === 'gifts') {
      const g = await sb.from('player_gifts').select('id,title,coins,rank_points,created_at')
        .eq('user_id', uid).is('claimed_at', null).order('id', { ascending: false }).limit(50);
      if (g.error) throw g.error;
      return res.status(200).json({ ok: true, gifts: g.data || [] });
    }

    if (act === 'claim_gift') {
      const gid = Math.floor(Number(b.id));
      if (!Number.isFinite(gid) || gid <= 0) return res.status(400).json({ ok: false, reason: 'id' });
      const taken = await sb.from('player_gifts').update({ claimed_at: new Date().toISOString() })
        .eq('id', gid).eq('user_id', uid).is('claimed_at', null).select('coins,rank_points');
      if (taken.error) throw taken.error;
      if (!taken.data || !taken.data.length) return res.status(200).json({ ok: false, reason: 'gone' });
      const amount = taken.data[0].coins;
      const rankPts = taken.data[0].rank_points || 0;
      let out;
      let rank = null;
      try {
        if (rankPts > 0) {
          const add = await sb.rpc('rank_add', { p_user: uid, p_points: rankPts });
          if (add.error) throw add.error;
          rank = { m: rankMonth(), p: add.data };
        }
        out = amount > 0
          ? await mutate(uid, r => ({ patch: { coins: Math.min(r.coins + amount, COIN_CEIL) } }))
          : { row: await loadRow(uid) };
      } catch (e) {
        if (!rank) {
          try { await sb.from('player_gifts').update({ claimed_at: null }).eq('id', gid).eq('user_id', uid); } catch (e2) {}
        }
        throw e;
      }
      return res.status(200).json({ ok: true, amount: amount, rankPoints: rankPts, rank: rank, state: view(out.row), granted: granted });
    }

    if (act === 'reset') {
      const out = await mutate(uid, r => ({
        patch: {
          coins: 0, owned_skins: ['default'], selected_skin: 'default', high_normal: 0, high_hard: 0,
          achievements: [], stats: {}, daily: {}, initialized: true
        }
      }));
      return res.status(200).json({ ok: true, state: view(out.row), granted: granted });
    }

    return res.status(400).json({ ok: false, reason: 'action' });
  } catch (e) {
    fail(res, 'progress', e);
  }
}
