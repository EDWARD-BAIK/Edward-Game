// Satu-satunya jalan skor masuk ke papan global. Semua dicek di server.
import { guard, body, authUser, readToken, ipHash, allow, sb, MAX_SPEED, TOKEN_TTL_MS, MAX_DIST, BAN_DIST, cleanName, nameOk, isBanned, ban, fail, dayJakarta } from './_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  try {
    const { name, dist, token } = body(req);
    const ip = ipHash(req);
    if (!(await allow('submit:ip:' + ip, 120, 60))) return res.status(429).json({ ok: false, reason: 'rate' });

    const u = await authUser(req);                       // identitas dari login Google, bukan dari body
    if (!u) return res.status(401).json({ ok: false, reason: 'login' });
    const id = u.id;

    // Token harus asli (ditandatangani server) dan milik id ini, baru ban boleh dijatuhkan.
    const t = readToken(token);
    if (!t || t.i !== id) return res.status(403).json({ ok: false, reason: 'token' });

    if (await isBanned(id, ip)) return res.status(403).json({ ok: false, reason: 'banned' });

    const d = Math.floor(Number(dist));
    const elapsedMs = Date.now() - t.t;
    const maxPossible = (Math.max(0, elapsedMs) / 1000) * MAX_SPEED + 20;

    // Jarak >= 100 km yang mustahil untuk waktu bermainnya => blacklist 1 hari (id + IP)
    if (Number.isFinite(d) && d >= BAN_DIST && d > maxPossible) {
      await ban(id, ip, 'dist ' + d + ' dalam ' + Math.round(elapsedMs / 1000) + ' detik');
      return res.status(403).json({ ok: false, reason: 'banned' });
    }

    const nm = cleanName(name);
    if (!nameOk(nm)) return res.status(400).json({ ok: false, reason: 'name_invalid' });
    if (!Number.isFinite(d) || d <= 0 || d > MAX_DIST) return res.status(400).json({ ok: false, reason: 'dist' });
    if (elapsedMs < 0 || elapsedMs > TOKEN_TTL_MS) return res.status(403).json({ ok: false, reason: 'expired' });
    if (d > maxPossible) return res.status(400).json({ ok: false, reason: 'impossible' });

    if (!(await allow('score:id:' + id, 1, 10))) return res.status(429).json({ ok: false, reason: 'rate' });
    if (!(await allow('score:ip:' + ip, 40, 60))) return res.status(429).json({ ok: false, reason: 'rate' });

    // Anti-replay: setiap token ronde hanya boleh dipakai sekali.
    const mode = t.m === 'hard' ? 'hard' : 'normal';
    const ins = await sb.from('used_nonces').insert({ nonce: t.n });
    if (ins.error) {
      if (ins.error.code === '23505') return res.status(403).json({ ok: false, reason: 'replay' });
      throw ins.error;
    }
    try {
      // Nama akun diperbarui tiap kirim skor, jadi papan skor selalu memakai nama terbaru.
      const upN = await sb.from('player_names').upsert(
        { id, name: nm, updated_at: new Date().toISOString() }, { onConflict: 'id' });
      if (upN.error) throw upN.error;

      const day = dayJakarta();
      const cur = await sb.from('daily_scores').select('dist')
        .eq('id', id).eq('day', day).eq('mode', mode).maybeSingle();
      if (cur.error) throw cur.error;
      if (!cur.data || d > cur.data.dist) {
        const upS = await sb.from('daily_scores').upsert({ id, day, mode, dist: d }, { onConflict: 'id,day,mode' });
        if (upS.error) throw upS.error;
      }
    } catch (werr) {
      // Gagal menyimpan: kembalikan token supaya bisa dicoba lagi.
      try { await sb.from('used_nonces').delete().eq('nonce', t.n); } catch (e2) {}
      throw werr;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    fail(res, 'submit-score', e);
  }
}
