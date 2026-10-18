import { guard, body, ID_RE, cleanName, nameOk, ipHash, allow, sb, authUser, fail } from './_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  try {
    const { name, legacyId } = body(req);
    const nm = cleanName(name);
    if (!nameOk(nm)) return res.status(200).json({ ok: false, reason: 'invalid' });

    const ip = ipHash(req);
    if (!(await allow('claim:ip:' + ip, 40, 60))) return res.status(429).json({ ok: false, reason: 'rate' });

    const u = await authUser(req);
    // Belum login: nama hanya disimpan lokal. Klaim global baru terjadi setelah login Google.
    if (!u) return res.status(200).json({ ok: true, reason: 'guest' });
    const id = u.id;
    if (!(await allow('claim:id:' + id, 6, 60))) return res.status(429).json({ ok: false, reason: 'rate' });

    let r = await sb.rpc('claim_name', { p_id: id, p_name: nm });
    if (r.error) throw r.error;
    // Pindahan dari ID lama (EDW-XXXXXX): lepas klaim lama lalu klaim ulang atas akun baru
    if (r.data !== true && ID_RE.test(String(legacyId || ''))) {
      const rel = await sb.rpc('release_name', { p_id: legacyId });
      if (rel.error) throw rel.error;
      r = await sb.rpc('claim_name', { p_id: id, p_name: nm });
      if (r.error) throw r.error;
    }
    // Nama boleh kembar: kalau bentrok dengan akun lain, tetap dianggap berhasil.
    res.status(200).json({ ok: true, reason: r.data === true ? 'ok' : 'dup' });
  } catch (e) {
    fail(res, 'claim-name', e);
  }
}
