// Helper bersama untuk semua endpoint /api. File berawalan "_" tidak jadi endpoint di Vercel.
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const sb = createClient(process.env.SB_URL, process.env.SB_SERVICE_KEY, {
  auth: { persistSession: false },
});

const SECRET = process.env.RUN_SECRET; // string acak panjang (>= 32 karakter)
const ALLOWED = (process.env.ALLOWED_ORIGINS || 'https://edward-game.vercel.app')
  .split(',').map(s => s.trim()).filter(Boolean);

export const MAX_SPEED = Number(process.env.MAX_SPEED || 40);        // meter/detik (batas fisik game ~46)
export const TOKEN_TTL_MS = Number(process.env.TOKEN_TTL_MIN || 90) * 60 * 1000;
export const MAX_DIST = 150000;                                       // 150 km, batas mutlak

export const ID_RE = /^EDW-[A-Z0-9]{6}$/;

const BLOCKED = ['hack', 'deface', 'pwned', 'admin', 'owner', 'script', 'onerror', 'system_', 'http', 'www.', '.com', 'anjing', 'kontol', 'memek'];

export function cleanName(s) {
  const n = String(s || '').normalize('NFKC')
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .replace(/\s+/g, ' ').trim().slice(0, 12);
  return n;
}
export function nameOk(n) {
  if (!n || n.length < 2) return false;
  const low = n.toLowerCase();
  return !BLOCKED.some(w => low.includes(w));
}

export function guard(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ ok: false, reason: 'method' }); return false; }
  const origin = req.headers.origin;
  if (!origin || !ALLOWED.includes(origin)) { res.status(403).json({ ok: false, reason: 'origin' }); return false; }
  const len = Number(req.headers['content-length'] || 0);
  if (len > 2048) { res.status(413).json({ ok: false, reason: 'size' }); return false; }
  if (!SECRET || !process.env.SB_URL || !process.env.SB_SERVICE_KEY) {
    res.status(500).json({ ok: false, reason: 'config' }); return false;
  }
  return true;
}

export function ipHash(req) {
  const ip = (req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '')
    .toString().split(',')[0].trim();
  return crypto.createHmac('sha256', SECRET).update(ip).digest('hex').slice(0, 24);
}

// Rate limit atomik di database. true = boleh lanjut.
export async function allow(key, max, windowSec) {
  const { data, error } = await sb.rpc('rl_hit', { p_key: key, p_max: max, p_window: windowSec });
  if (error) throw error;
  return data === true;
}

const b64 = b => Buffer.from(b).toString('base64url');
const sign = p => crypto.createHmac('sha256', SECRET).update(p).digest('base64url');

export function makeToken(id, mode) {
  const payload = b64(JSON.stringify({ i: id, m: mode, n: crypto.randomBytes(12).toString('hex'), t: Date.now() }));
  return payload + '.' + sign(payload);
}

export function readToken(tok) {
  if (typeof tok !== 'string' || tok.length > 400) return null;
  const [payload, sig] = tok.split('.');
  if (!payload || !sig) return null;
  const good = sign(payload);
  const a = Buffer.from(sig), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { return null; }
}

export function body(req) {
  return (req.body && typeof req.body === 'object') ? req.body : {};
}
