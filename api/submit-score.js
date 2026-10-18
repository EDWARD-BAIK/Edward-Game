// Satu-satunya jalan skor masuk ke papan global. Semua dicek di server.
import { guard, body, ID_RE, readToken, ipHash, allow, sb, MAX_SPEED, TOKEN_TTL_MS, MAX_DIST, cleanName, nameOk } from './_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  try {
    const { id, name, dist, token } = body(req);
    if (!ID_RE.test(String(id))) return res.status(400).json({ ok: false, reason: 'id' });

    const nm = cleanName(name);
    if (!nameOk(nm)) return res.status(400).json({ ok: false, reason: 'name_invalid' });

    const d = Math.floor(Number(dist));
    if (!Number.isFinite(d) || d <= 0 || d > MAX_DIST) return res.status(400).json({ ok: false, reason: 'dist' });

    const t = readToken(token);
    if (!t || t.i !== id) return res.status(403).json({ ok: false, reason: 'token' });

    const elapsedMs = Date.now() - t.t;
    if (elapsedMs < 0 || elapsedMs > TOKEN_TTL_MS) return res.status(403).json({ ok: false, reason: 'expired' });
    // Jarak yang mustahil dicapai dalam waktu segitu -> tolak
    if (d > (elapsedMs / 1000) * MAX_SPEED + 20) return res.status(400).json({ ok: false, reason: 'impossible' });

    const ip = ipHash(req);
    if (!(await allow('score:id:' + id, 1, 10))) return res.status(429).json({ ok: false, reason: 'rate' });
    if (!(await allow('score:ip:' + ip, 40, 60))) return res.status(429).json({ ok: false, reason: 'rate' });

    const { data, error } = await sb.rpc('submit_score_secure', {
      p_id: id, p_name: nm, p_dist: d, p_mode: t.m === 'hard' ? 'hard' : 'normal', p_nonce: t.n,
    });
    if (error) throw error;
    if (data !== 'ok') return res.status(data === 'replay' ? 403 : 409).json({ ok: false, reason: data });
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('submit-score', e);
    res.status(500).json({ ok: false, reason: 'server' });
  }
}
