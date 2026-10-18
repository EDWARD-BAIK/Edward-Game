import { guard, body, ID_RE, cleanName, nameOk, ipHash, allow, sb, fail } from './_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  try {
    const { id, name } = body(req);
    if (!ID_RE.test(String(id))) return res.status(400).json({ ok: false, reason: 'id' });
    const nm = cleanName(name);
    if (!nameOk(nm)) return res.status(200).json({ ok: false, reason: 'invalid' });

    const ip = ipHash(req);
    if (!(await allow('claim:id:' + id, 6, 60))) return res.status(429).json({ ok: false, reason: 'rate' });
    if (!(await allow('claim:ip:' + ip, 40, 60))) return res.status(429).json({ ok: false, reason: 'rate' });

    const { data, error } = await sb.rpc('claim_name', { p_id: id, p_name: nm });
    if (error) throw error;
    res.status(200).json({ ok: data === true, reason: data === true ? 'ok' : 'taken' });
  } catch (e) {
    fail(res, 'claim-name', e);
  }
}
