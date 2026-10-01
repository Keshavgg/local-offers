import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { db } from './db.js';
import { sendMail, otpEmail, resetEmail } from './mail.js';
import { normPhone } from './phone.js';
import { startTelegram, telegramEnabled, signupLink, sendTelegram } from './telegram.js';

const PORT = Number(process.env.PORT || 3001);
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const PHONE_SIGNUP_TTL_MS = 15 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

// JWT secret: env var, else a generated one persisted in data/.secret
const secretFile = path.resolve(import.meta.dirname, '../data/.secret');
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  mkdirSync(path.dirname(secretFile), { recursive: true });
  if (!existsSync(secretFile)) writeFileSync(secretFile, crypto.randomBytes(32).toString('hex'));
  return readFileSync(secretFile, 'utf8');
})();

const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' });
  next();
});
app.use(express.json({ limit: '1mb' }));

// ---------- helpers ----------
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const httpError = (status, message, extra) => Object.assign(new Error(message), { status, extra });
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const hashPassword = (pw) => {
  const salt = crypto.randomBytes(16);
  return `${salt.toString('hex')}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
};
const checkPassword = (pw, stored) => {
  const [salt, hash] = stored.split(':');
  const a = Buffer.from(hash, 'hex');
  const b = crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const normEmail = (e) => String(e || '').trim().toLowerCase();
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const ROLES = new Set(['customer', 'owner']);
const publicUser = (u) => ({ id: u.id, email: u.email, role: u.role, full_name: u.full_name, phone: u.phone, phone_verified: !!u.phone_verified, locality: u.locality, created_date: u.created_date });
const signToken = (user) => jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '30d' });

function requireAuth(req, _res, next) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  try {
    const { sub } = jwt.verify(m?.[1] || '', JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND verified = 1').get(sub);
    if (!user) throw new Error('no user');
    req.user = user;
    next();
  } catch {
    next(httpError(401, 'Not authenticated'));
  }
}

// Naive in-memory rate limiter for auth endpoints
const hits = new Map();
const LIMIT_SCALE = Number(process.env.RATE_LIMIT_SCALE || 1); // tests loosen this; production keeps 1
const rateLimit = (max, windowMs) => (req, _res, next) => {
  const key = `${req.path}:${req.ip}`;
  const t = Date.now();
  const arr = (hits.get(key) || []).filter((x) => t - x < windowMs);
  arr.push(t);
  hits.set(key, arr);
  next(arr.length > max * LIMIT_SCALE ? httpError(429, 'Too many attempts, try again later') : undefined);
};

async function issueOtp(user) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  db.prepare("DELETE FROM tokens WHERE user_id = ? AND kind = 'otp'").run(user.id);
  db.prepare('INSERT INTO tokens (id, user_id, kind, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(uid(), user.id, 'otp', sha(code), Date.now() + OTP_TTL_MS);
  await sendMail({ to: user.email, ...otpEmail(code) });
}

// ---------- auth ----------
const auth = express.Router();

auth.post('/register', rateLimit(10, 60_000), wrap(async (req, res) => {
  const email = normEmail(req.body.email);
  const password = String(req.body.password || '');
  const role = req.body.role ?? 'customer';
  const hasPhone = String(req.body.phone ?? '').trim() !== '';
  const phone = hasPhone ? normPhone(req.body.phone) : null;
  if (hasPhone && !phone) throw httpError(400, 'Enter a valid phone number (10-digit Indian mobile, or with + and country code)');
  if (!ROLES.has(role)) throw httpError(400, 'Choose customer or shop owner');
  if (!validEmail(email)) throw httpError(400, 'Enter a valid email address');
  if (password.length < 8) throw httpError(400, 'Password must be at least 8 characters');

  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (user?.verified) throw httpError(409, 'An account with this email already exists');
  if (phone) {
    const holder = db.prepare('SELECT * FROM users WHERE phone = ? AND email != ?').get(phone, email);
    if (holder?.verified) throw httpError(409, 'An account with this phone number already exists');
    if (holder) db.prepare('UPDATE users SET phone = NULL WHERE id = ?').run(holder.id); // unverified sign-up can't block the number
  }
  if (user) {
    db.prepare('UPDATE users SET password_hash = ?, role = ?, phone = ? WHERE id = ?').run(hashPassword(password), role, phone, user.id); // unverified: allow retry
  } else {
    user = { id: uid(), email, full_name: email.split('@')[0] };
    db.prepare('INSERT INTO users (id, email, full_name, role, phone, password_hash, verified, created_date) VALUES (?, ?, ?, ?, ?, ?, 0, ?)')
      .run(user.id, email, user.full_name, role, phone, hashPassword(password), now());
  }
  await issueOtp(user);
  res.status(201).json({});
}));

auth.post('/verify-otp', rateLimit(20, 60_000), wrap(async (req, res) => {
  const email = normEmail(req.body.email);
  const code = String(req.body.otpCode || '').trim();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const tok = user && db.prepare("SELECT * FROM tokens WHERE user_id = ? AND kind = 'otp'").get(user.id);
  if (!tok || tok.expires_at < Date.now()) throw httpError(400, 'Code expired. Request a new one.');
  if (tok.attempts >= MAX_OTP_ATTEMPTS) throw httpError(429, 'Too many wrong codes. Request a new one.');
  if (sha(code) !== tok.token_hash) {
    db.prepare('UPDATE tokens SET attempts = attempts + 1 WHERE id = ?').run(tok.id);
    throw httpError(400, 'Invalid verification code');
  }
  db.prepare('DELETE FROM tokens WHERE id = ?').run(tok.id);
  db.prepare('UPDATE users SET verified = 1 WHERE id = ?').run(user.id);
  res.json({ access_token: signToken(user), user: publicUser(user) });
}));

auth.post('/resend-otp', rateLimit(5, 60_000), wrap(async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND verified = 0').get(normEmail(req.body.email));
  if (user) await issueOtp(user);
  res.json({});
}));

auth.post('/login', rateLimit(15, 60_000), wrap(async (req, res) => {
  // Log in with an email address or a phone number
  const id = String(req.body.identifier ?? req.body.email ?? '').trim();
  const user = id.includes('@')
    ? db.prepare('SELECT * FROM users WHERE email = ?').get(normEmail(id))
    : (normPhone(id) && db.prepare('SELECT * FROM users WHERE phone = ?').get(normPhone(id)));
  if (!user || !checkPassword(String(req.body.password || ''), user.password_hash)) throw httpError(401, 'Invalid email/phone or password');
  if (!user.verified) {
    await issueOtp(user);
    throw httpError(403, 'Email not verified. We sent a new code.', { email: user.email });
  }
  res.json({ access_token: signToken(user), user: publicUser(user) });
}));

auth.get('/me', requireAuth, (req, res) => res.json(publicUser(req.user)));

auth.patch('/me', requireAuth, (req, res) => {
  const { locality, phone, full_name } = req.body;
  let newPhone; // undefined = leave unchanged, null = remove
  if (phone !== undefined) {
    newPhone = String(phone ?? '').trim() === '' ? null : normPhone(phone);
    if (newPhone === null && String(phone ?? '').trim() !== '') throw httpError(400, 'Enter a valid phone number (10-digit Indian mobile, or with + and country code)');
    if (newPhone && db.prepare('SELECT 1 FROM users WHERE phone = ? AND id != ?').get(newPhone, req.user.id)) throw httpError(409, 'This phone number is used by another account');
  }
  if (full_name !== undefined && !String(full_name).trim()) throw httpError(400, 'Name cannot be empty');
  db.prepare('UPDATE users SET locality = COALESCE(?, locality), full_name = COALESCE(?, full_name) WHERE id = ?')
    .run(locality === undefined ? null : String(locality).trim().slice(0, 80), full_name === undefined ? null : String(full_name).trim().slice(0, 60), req.user.id);
  if (newPhone !== undefined && newPhone !== req.user.phone) {
    // A phone-only account has no other way to log in, so its verified number is fixed for now
    if (!req.user.email && req.user.phone_verified) throw httpError(400, 'This number is your login and cannot be changed yet');
    db.prepare('UPDATE users SET phone = ?, phone_verified = 0 WHERE id = ?').run(newPhone, req.user.id); // a new number must be re-verified
  }
  res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)));
});

auth.post('/reset-request', rateLimit(5, 60_000), wrap(async (req, res) => {
  // Accepts an email or a phone number; the link always goes to the email on the account
  const id = String(req.body.identifier ?? req.body.email ?? '').trim();
  const user = id.includes('@')
    ? db.prepare('SELECT * FROM users WHERE email = ? AND verified = 1').get(normEmail(id))
    : (normPhone(id) && db.prepare('SELECT * FROM users WHERE phone = ? AND verified = 1').get(normPhone(id)));
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare("DELETE FROM tokens WHERE user_id = ? AND kind = 'reset'").run(user.id);
    db.prepare('INSERT INTO tokens (id, user_id, kind, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)')
      .run(uid(), user.id, 'reset', sha(token), Date.now() + RESET_TTL_MS);
    const url = `${APP_URL}/reset-password?token=${token}`;
    // Send by every channel the account has: email, and Telegram for phone sign-ups
    if (user.email) await sendMail({ to: user.email, ...resetEmail(url) });
    if (user.telegram_id && telegramEnabled()) {
      await sendTelegram(user.telegram_id, `Reset your ${process.env.APP_NAME || 'Local Offers'} password (link valid for 1 hour):
${url}

If you didn't ask for this, ignore this message.`)
        .catch((e) => console.error('Telegram reset message failed:', e.message));
    }
  }
  res.json({}); // same response whether or not the account exists
}));

auth.post('/reset', rateLimit(10, 60_000), wrap(async (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (String(newPassword || '').length < 8) throw httpError(400, 'Password must be at least 8 characters');
  const tok = db.prepare("SELECT * FROM tokens WHERE kind = 'reset' AND token_hash = ?").get(sha(String(resetToken || '')));
  if (!tok || tok.expires_at < Date.now()) throw httpError(400, 'Invalid or expired reset link');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), tok.user_id);
  db.prepare('DELETE FROM tokens WHERE id = ?').run(tok.id);
  res.json({});
}));

// ---------- phone sign-up through Telegram ----------
auth.get('/phone/config', (_req, res) => res.json({ enabled: telegramEnabled() }));

auth.post('/phone/start', rateLimit(10, 60_000), wrap(async (req, res) => {
  if (!telegramEnabled()) throw httpError(503, 'Phone sign-up is not available right now');
  const role = req.body.role ?? 'customer';
  if (!ROLES.has(role)) throw httpError(400, 'Choose customer or shop owner');
  db.prepare('DELETE FROM phone_signups WHERE expires_at < ?').run(Date.now());
  const token = crypto.randomBytes(18).toString('base64url');
  db.prepare('INSERT INTO phone_signups (token_hash, role, expires_at) VALUES (?, ?, ?)').run(sha(token), role, Date.now() + PHONE_SIGNUP_TTL_MS);
  res.status(201).json({ token, link: signupLink(token) });
}));

auth.get('/phone/status', rateLimit(90, 60_000), (req, res) => {
  const row = db.prepare('SELECT status, phone, expires_at FROM phone_signups WHERE token_hash = ?').get(sha(String(req.query.token || '')));
  if (!row || row.expires_at < Date.now()) return res.json({ status: 'expired' });
  res.json({ status: row.status === 'started' ? 'waiting' : row.status, phone_last4: row.phone ? row.phone.slice(-4) : undefined });
});

auth.post('/phone/complete', rateLimit(10, 60_000), wrap(async (req, res) => {
  const password = String(req.body.password || '');
  if (password.length < 8) throw httpError(400, 'Password must be at least 8 characters');
  const th = sha(String(req.body.token || ''));
  const row = db.prepare('SELECT * FROM phone_signups WHERE token_hash = ?').get(th);
  if (!row || row.expires_at < Date.now()) throw httpError(400, 'This sign-up expired. Please start again.');
  if (row.status !== 'verified') throw httpError(400, 'Your phone number is not verified yet');

  const holder = db.prepare('SELECT * FROM users WHERE phone = ?').get(row.phone);
  if (holder?.phone_verified) throw httpError(409, 'An account with this phone number already exists');
  if (db.prepare('SELECT 1 FROM users WHERE telegram_id = ?').get(row.telegram_id)) throw httpError(409, 'This Telegram account is already registered');
  // The person just proved they own this number, so it wins over an unverified claim by someone else
  if (holder) db.prepare('UPDATE users SET phone = NULL WHERE id = ?').run(holder.id);

  const id = uid();
  const name = String(req.body.full_name || row.first_name || '').trim().slice(0, 60) || 'New user';
  db.prepare('INSERT INTO users (id, email, full_name, role, phone, phone_verified, telegram_id, password_hash, verified, created_date) VALUES (?, NULL, ?, ?, ?, 1, ?, ?, 1, ?)')
    .run(id, name, row.role, row.phone, row.telegram_id, hashPassword(password), now());
  db.prepare('DELETE FROM phone_signups WHERE token_hash = ?').run(th);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.status(201).json({ access_token: signToken(user), user: publicUser(user) });
}));

app.use('/api/auth', auth);

// ---------- entities (Business / Offer / Review) ----------
const ENTITIES = new Set(['Business', 'Offer', 'Review']);
const BUSINESS_TYPES = new Set([
  'restaurant', 'cafe', 'bakery', 'temple', 'clothing', 'electronics', 'grocery',
  'bookstore', 'salon', 'gym', 'pet_care', 'repair', 'pharmacy',
]);
const FIELDS = {
  Business: ['name', 'entity_type', 'subtitle', 'locality', 'address', 'lat', 'lng', 'cover_url', 'phone', 'whatsapp', 'description', 'hours', 'items', 'owner_name', 'owner_phone'],
  Offer: ['business_id', 'title', 'type', 'max_saving_paise', 'config', 'starts_at', 'ends_at', 'status', 'terms'],
  Review: ['business_id', 'rating', 'body'],
};
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const str = (v, max, label, { required = false } = {}) => {
  const s = v == null ? '' : String(v).trim();
  if (required && !s) throw httpError(400, `${label} is required`);
  if (s.length > max) throw httpError(400, `${label} is too long (max ${max} characters)`);
  return s;
};

// Keep only known fields and trim strings; unknown/server-controlled fields are dropped.
const pick = (entity, input) => {
  const out = {};
  for (const k of FIELDS[entity]) if (input && k in input) out[k] = input[k];
  return out;
};

function validate(entity, d) {
  if (entity === 'Business') {
    d.name = str(d.name, 100, 'Name', { required: true });
    if (!BUSINESS_TYPES.has(d.entity_type)) throw httpError(400, 'Choose a valid business type');
    for (const [k, max] of [['subtitle', 160], ['locality', 80], ['address', 300], ['description', 2000], ['owner_name', 100]]) d[k] = str(d[k], max, k);
    for (const k of ['phone', 'whatsapp', 'owner_phone']) {
      d[k] = str(d[k], 20, 'Phone number');
      if (d[k] && !/^[+\d][\d\s-]{5,19}$/.test(d[k])) throw httpError(400, 'Enter a valid phone number');
    }
    d.cover_url = str(d.cover_url, 500, 'Cover photo URL');
    if (d.cover_url && !/^https?:\/\//i.test(d.cover_url)) throw httpError(400, 'Cover photo must be an http(s) link');
    for (const [k, lim] of [['lat', 90], ['lng', 180]]) {
      if (d[k] == null || d[k] === '') delete d[k];
      else if (!isNum(d[k]) || Math.abs(d[k]) > lim) throw httpError(400, `Invalid ${k}`);
    }
    d.hours = d.hours ?? [];
    if (!Array.isArray(d.hours) || d.hours.length > 14 || d.hours.some((h) => !TIME.test(h?.open || '') || !TIME.test(h?.close || ''))) throw httpError(400, 'Opening hours must be HH:MM');
    d.items = d.items ?? [];
    if (!Array.isArray(d.items) || d.items.length > 300) throw httpError(400, 'Too many items');
    d.items = d.items.map((i) => ({
      section: str(i?.section, 50, 'Section'),
      name: str(i?.name, 100, 'Item name', { required: true }),
      description: str(i?.description, 300, 'Item description'),
      price_paise: isNum(i?.price_paise) && i.price_paise >= 0 ? Math.round(i.price_paise) : 0,
      is_available: i?.is_available !== false,
    }));
  } else if (entity === 'Offer') {
    d.title = str(d.title, 120, 'Title', { required: true });
    d.terms = str(d.terms, 300, 'Terms');
    if (!['PERCENT', 'FLAT', 'BOGO'].includes(d.type)) throw httpError(400, 'Unknown offer type');
    const c = d.config || {};
    const pos = (v, label) => { if (!(isNum(v) && v > 0)) throw httpError(400, `${label} must be a positive number`); };
    if (d.type === 'PERCENT') { pos(c.percent, 'Percent'); if (c.percent > 100) throw httpError(400, 'Percent cannot exceed 100'); pos(c.max_discount, 'Max discount'); }
    if (d.type === 'FLAT') pos(c.flat_amount, 'Discount');
    if (d.type === 'BOGO') { pos(c.buy_qty, 'Buy quantity'); pos(c.get_qty, 'Free quantity'); pos(c.item_price, 'Item price'); }
    d.config = c;
    if (!(isNum(d.max_saving_paise) && d.max_saving_paise >= 0)) throw httpError(400, 'Invalid maximum saving');
    const s = Date.parse(d.starts_at), e = Date.parse(d.ends_at);
    if (!(s && e) || e < s) throw httpError(400, 'Invalid offer dates');
    d.status = d.status === 'PAUSED' ? 'PAUSED' : 'LIVE';
  } else if (entity === 'Review') {
    if (!(Number.isInteger(d.rating) && d.rating >= 1 && d.rating <= 5)) throw httpError(400, 'Rating must be 1 to 5');
    d.body = str(d.body, 1000, 'Review', { required: true });
  }
  return d;
}

// Offers report their effective status: paused by the owner, or by the dates.
function effectiveStatus(o) {
  if (o.status === 'PAUSED') return 'PAUSED';
  const t = Date.now();
  if (Date.parse(o.ends_at) < t) return 'EXPIRED';
  if (Date.parse(o.starts_at) > t) return 'SCHEDULED';
  return 'LIVE';
}

const entities = express.Router();
entities.use(requireAuth);
entities.param('name', (req, _res, next, name) => (ENTITIES.has(name) ? next() : next(httpError(404, 'Unknown entity'))));

const toDoc = (r) => {
  const d = { ...JSON.parse(r.data), id: r.id, owner_id: r.owner_id, created_date: r.created_date, updated_date: r.updated_date };
  if (r.entity === 'Offer') d.status = effectiveStatus(d);
  return d;
};
const parseJson = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { throw httpError(400, 'Bad query'); } };

const matches = (rec, query) => Object.entries(query).every(([field, cond]) => {
  const val = rec[field];
  if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
    if ('$in' in cond && !(Array.isArray(cond.$in) && cond.$in.includes(val))) return false;
    if ('$regex' in cond) {
      const pattern = String(cond.$regex).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // literal match: no user regex (ReDoS)
      if (!new RegExp(pattern, cond.$options?.includes('i') ? 'i' : '').test(val ?? '')) return false;
    }
    if ('$ne' in cond && val === cond.$ne) return false;
    return true;
  }
  return val === cond;
});

const loadAll = (entity) => db.prepare('SELECT * FROM records WHERE entity = ?').all(entity).map(toDoc);

function recomputeRating(businessId) {
  const reviews = loadAll('Review').filter((r) => r.business_id === businessId);
  const row = db.prepare("SELECT data FROM records WHERE id = ? AND entity = 'Business'").get(businessId);
  if (!row) return;
  const data = JSON.parse(row.data);
  data.review_count = reviews.length;
  data.rating = reviews.length ? Math.round((reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length) * 10) / 10 : 0;
  db.prepare('UPDATE records SET data = ? WHERE id = ?').run(JSON.stringify(data), businessId);
}

entities.get('/:name', (req, res) => {
  const query = parseJson(req.query.query, {});
  let rows = loadAll(req.params.name).filter((r) => matches(r, query));
  const sort = String(req.query.sort || '-created_date');
  const desc = sort.startsWith('-');
  const key = sort.replace(/^-/, '');
  rows.sort((a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * (desc ? -1 : 1));
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  rows = rows.slice(0, limit);
  const fields = parseJson(req.query.fields, null);
  if (fields) rows = rows.map((r) => ({ id: r.id, ...Object.fromEntries(fields.map((f) => [f, r[f]])) }));
  res.json({ items: rows });
});

entities.get('/:name/count', (req, res) => {
  const query = parseJson(req.query.query, {});
  res.json({ count: loadAll(req.params.name).filter((r) => matches(r, query)).length });
});

entities.get('/:name/aggregate', (req, res) => {
  const field = String(req.query.avg || '');
  if (!/^[a-z_]+$/i.test(field)) throw httpError(400, 'Bad field');
  const vals = loadAll(req.params.name).map((r) => r[field]).filter((v) => typeof v === 'number');
  res.json({ rows: [{ [`avg_${field}`]: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null }] });
});

entities.get('/:name/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM records WHERE id = ? AND entity = ?').get(req.params.id, req.params.name);
  if (!row) throw httpError(404, `${req.params.name} not found`);
  res.json(toDoc(row));
});

const businessOwner = (id) => id && db.prepare("SELECT owner_id FROM records WHERE id = ? AND entity = 'Business'").get(id);

entities.post('/:name', (req, res) => {
  const { name } = req.params;
  const data = validate(name, pick(name, req.body));
  const business = name !== 'Business' ? businessOwner(data.business_id) : null;
  if (name === 'Business' && req.user.role !== 'owner') throw httpError(403, 'Only shop owner accounts can list a business');
  if (name === 'Offer' && business?.owner_id !== req.user.id) throw httpError(403, 'You can only add offers to your own business');
  if (name === 'Review') {
    if (!business) throw httpError(400, 'Business not found');
    if (business.owner_id === req.user.id) throw httpError(403, "You can't review your own business");
    const dup = db.prepare("SELECT 1 FROM records WHERE entity = 'Review' AND owner_id = ? AND json_extract(data, '$.business_id') = ?").get(req.user.id, data.business_id);
    if (dup) throw httpError(409, 'You have already reviewed this place');
    data.author = req.user.full_name || 'Customer';
    data.date = new Date().toISOString().slice(0, 10);
  }
  if (name === 'Business') Object.assign(data, { rating: 0, review_count: 0, verified: false });
  const id = uid();
  const ts = now();
  db.prepare('INSERT INTO records (id, entity, owner_id, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, name, req.user.id, JSON.stringify(data), ts, ts);
  if (name === 'Review') recomputeRating(data.business_id);
  res.status(201).json(toDoc(db.prepare('SELECT * FROM records WHERE id = ?').get(id)));
});

entities.patch('/:name/:id', (req, res) => {
  const { name } = req.params;
  const row = db.prepare('SELECT * FROM records WHERE id = ? AND entity = ?').get(req.params.id, name);
  if (!row) throw httpError(404, `${name} not found`);
  const stored = JSON.parse(row.data);

  // The owner of a business may answer reviews on it (only the `reply` field).
  if (name === 'Review' && row.owner_id !== req.user.id) {
    if (businessOwner(stored.business_id)?.owner_id !== req.user.id) throw httpError(403, 'You can only change your own records');
    const reply = str(req.body?.reply, 1000, 'Reply');
    const data = { ...stored, reply };
    if (!reply) delete data.reply;
    db.prepare('UPDATE records SET data = ?, updated_date = ? WHERE id = ?').run(JSON.stringify(data), now(), row.id);
    return res.json(toDoc(db.prepare('SELECT * FROM records WHERE id = ?').get(row.id)));
  }

  if (row.owner_id !== req.user.id) throw httpError(403, 'You can only change your own records');
  const patch = pick(name, req.body);
  delete patch.business_id; // can't move a record to another business
  const server = name === 'Business' ? { rating: stored.rating, review_count: stored.review_count, verified: stored.verified }
    : name === 'Review' ? { author: stored.author, date: stored.date, reply: stored.reply } : {};
  const data = { ...validate(name, { ...stored, ...patch }), ...server, ...(name === 'Offer' || name === 'Review' ? { business_id: stored.business_id } : {}) };
  db.prepare('UPDATE records SET data = ?, updated_date = ? WHERE id = ?').run(JSON.stringify(data), now(), row.id);
  if (name === 'Review') recomputeRating(stored.business_id);
  res.json(toDoc(db.prepare('SELECT * FROM records WHERE id = ?').get(row.id)));
});

entities.delete('/:name/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM records WHERE id = ? AND entity = ?').get(req.params.id, req.params.name);
  if (!row) throw httpError(404, `${req.params.name} not found`);
  if (row.owner_id !== req.user.id) throw httpError(403, 'You can only change your own records');
  db.prepare('DELETE FROM records WHERE id = ?').run(row.id);
  if (req.params.name === 'Review') recomputeRating(JSON.parse(row.data).business_id);
  if (req.params.name === 'Business') {
    for (const e of ['Offer', 'Review']) for (const r of loadAll(e).filter((r) => r.business_id === row.id)) db.prepare('DELETE FROM records WHERE id = ?').run(r.id);
    db.prepare('DELETE FROM saved WHERE business_id = ?').run(row.id);
  }
  res.json({});
});

app.use('/api/entities', entities);

// ---------- saved places (private to each user) ----------
const saved = express.Router();
saved.use(requireAuth);
saved.get('/', (req, res) => {
  res.json({ ids: db.prepare('SELECT business_id FROM saved WHERE user_id = ? ORDER BY created_date DESC').all(req.user.id).map((r) => r.business_id) });
});
saved.put('/:businessId', (req, res) => {
  if (!db.prepare("SELECT 1 FROM records WHERE id = ? AND entity = 'Business'").get(req.params.businessId)) throw httpError(404, 'Place not found');
  db.prepare('INSERT OR IGNORE INTO saved (user_id, business_id, created_date) VALUES (?, ?, ?)').run(req.user.id, req.params.businessId, now());
  res.json({});
});
saved.delete('/:businessId', (req, res) => {
  db.prepare('DELETE FROM saved WHERE user_id = ? AND business_id = ?').run(req.user.id, req.params.businessId);
  res.json({});
});
app.use('/api/saved', saved);

// ---------- errors ----------
app.use('/api', (_req, _res, next) => next(httpError(404, 'Not found')));
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status >= 500 ? 'Server error' : err.message, ...(status < 500 ? err.extra : {}) });
});

// Serve the production build (npm run build) when present
const dist = path.resolve(import.meta.dirname, '../dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
startTelegram(); // no-op unless TELEGRAM_BOT_TOKEN is set
