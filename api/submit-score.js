// Satu-satunya jalan skor masuk ke papan global. Semua dicek di server.
import { guard, body, ID_RE, readToken, ipHash, allow, sb, MAX_SPEED, TOKEN_TTL_MS, MAX_DIST, BAN_DIST, cleanName, nameOk, isBanned, ban, fail } from './_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  try {
    const { id, name, dist, token } = body(req);
    if (!ID_RE.test(String(id))) return res.status(400).json({ ok: false, reason: 'id' });

    // Token harus asli (ditandatangani server) dan milik id ini, baru ban boleh dijatuhkan.
    const t = readToken(token);
    if (!t || t.i !== id) return res.status(403).json({ ok: false, reason: 'token' });

    const ip = ipHash(req);
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

    const { data, error } = await sb.rpc('submit_score_secure', {
      p_id: id, p_name: nm, p_dist: d, p_mode: t.m === 'hard' ? 'hard' : 'normal', p_nonce: t.n,
    });
    if (error) throw error;
    if (data !== 'ok') return res.status(data === 'replay' ? 403 : 409).json({ ok: false, reason: data });
    res.status(200).json({ ok: true });
  } catch (e) {
    fail(res, 'submit-score', e);
  }
}
