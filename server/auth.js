import crypto from 'node:crypto';
// Passwords are never stored. We keep a salted scrypt hash, which is slow on purpose so guessing is expensive.
const scrypt = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 64, (e, k) => (e ? rej(e) : res(k))));
export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return `${salt.toString('hex')}:${(await scrypt(pw, salt)).toString('hex')}`;
}
export async function verifyPassword(pw, stored) {
  const [salt, key] = stored.split(':');
  const test = await scrypt(pw, Buffer.from(salt, 'hex')), real = Buffer.from(key, 'hex');
  return real.length === test.length && crypto.timingSafeEqual(real, test);
}
// A login "ticket": user id + expiry, signed with a secret so it cannot be forged or edited.
const sign = (body, secret) => crypto.createHmac('sha256', secret).update(body).digest('base64url');
export function signToken(uid, secret, ttlMs = 30 * 864e5) {
  const body = Buffer.from(JSON.stringify({ uid, exp: Date.now() + ttlMs })).toString('base64url');
  return `${body}.${sign(body, secret)}`;
}
export function verifyToken(token, secret) {
  try {
    const [body, sig] = String(token).split('.'), good = sign(body, secret);
    if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
    const p = JSON.parse(Buffer.from(body, 'base64url')); return p.exp > Date.now() ? p.uid : null;
  } catch { return null; }
}
export const parseCookies = h => Object.fromEntries(String(h || '').split(';').map(s => s.trim().split('=')).filter(p => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
