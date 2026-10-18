// Dipanggil game saat ronde dimulai. WAJIB login Google. Token memuat waktu mulai dari SERVER.
import { guard, body, makeToken, ipHash, allow, isBanned, authUser, fail } from './_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  try {
    const ip = ipHash(req);
    if (!(await allow('start:ip:' + ip, 60, 60))) return res.status(429).json({ ok: false, reason: 'rate' });

    const u = await authUser(req);
    if (!u) return res.status(401).json({ ok: false, reason: 'login' });
    const id = u.id;

    if (await isBanned(id, ip)) return res.status(403).json({ ok: false, reason: 'banned' });
    if (!(await allow('start:id:' + id, 1, 3))) return res.status(429).json({ ok: false, reason: 'rate' });

    const m = body(req).mode === 'hard' ? 'hard' : 'normal';
    res.status(200).json({ ok: true, token: makeToken(id, m) });
  } catch (e) {
    fail(res, 'start-run', e);
  }
}
