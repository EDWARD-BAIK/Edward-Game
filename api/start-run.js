// Dipanggil game saat ronde dimulai. Mengembalikan token bertanda tangan berisi waktu mulai dari SERVER.
import { guard, body, ID_RE, makeToken, ipHash, allow } from './_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  try {
    const { id, mode } = body(req);
    if (!ID_RE.test(String(id))) return res.status(400).json({ ok: false, reason: 'id' });
    const m = mode === 'hard' ? 'hard' : 'normal';

    const ip = ipHash(req);
    if (!(await allow('start:id:' + id, 1, 3))) return res.status(429).json({ ok: false, reason: 'rate' });
    if (!(await allow('start:ip:' + ip, 60, 60))) return res.status(429).json({ ok: false, reason: 'rate' });

    res.status(200).json({ ok: true, token: makeToken(id, m) });
  } catch (e) {
    console.error('start-run', e);
    res.status(500).json({ ok: false, reason: 'server' });
  }
}
