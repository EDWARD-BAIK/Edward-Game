import { guard, body, ID_RE, ipHash, allow, sb, fail } from './_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  try {
    const { id } = body(req);
    if (!ID_RE.test(String(id))) return res.status(400).json({ ok: false, reason: 'id' });
    if (!(await allow('release:ip:' + ipHash(req), 10, 60))) return res.status(429).json({ ok: false, reason: 'rate' });
    const { error } = await sb.rpc('release_name', { p_id: id });
    if (error) throw error;
    res.status(200).json({ ok: true });
  } catch (e) {
    fail(res, 'release-name', e);
  }
}
