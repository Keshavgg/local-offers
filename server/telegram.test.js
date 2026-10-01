// Run with: npm test
// Exercises phone sign-up through Telegram against a fake Telegram server (no real bot needed).
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

const API_PORT = 3098;
const TG_PORT = 3097;
const BASE = `http://localhost:${API_PORT}/api`;
const dir = mkdtempSync(path.join(tmpdir(), 'lo-tg-'));
let server, fake, log = '';

// ---- fake Telegram Bot API ----
const queue = [];          // updates waiting to be delivered
const sent = [];           // messages the bot sent
let updateId = 1;
const deliver = (message) => queue.push({ update_id: updateId++, message });
const user = (id, first = 'Asha') => ({ id, first_name: first });
const startMsg = (id, token) => ({ chat: { id, type: 'private' }, from: user(id), text: `/start ${token}` });
const contactMsg = (id, phone, contactUserId = id) => ({ chat: { id, type: 'private' }, from: user(id), contact: { phone_number: phone, user_id: contactUserId, first_name: 'Asha' } });
const lastSentTo = (chat) => sent.filter((m) => String(m.chat_id) === String(chat)).at(-1);
const settle = (ms = 700) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  fake = http.createServer(async (req, res) => {
    let body = '';
    for await (const c of req) body += c;
    const method = req.url.split('/').pop();
    const json = (result) => res.end(JSON.stringify({ ok: true, result }));
    if (method === 'getMe') return json({ username: 'TestBot' });
    if (method === 'sendMessage') { sent.push(JSON.parse(body)); return json({}); }
    if (method === 'getUpdates') {
      const until = Date.now() + 800;
      while (!queue.length && Date.now() < until) await new Promise((r) => setTimeout(r, 40));
      return json(queue.splice(0));
    }
    res.statusCode = 404; res.end('{}');
  });
  await new Promise((r) => fake.listen(TG_PORT, r));

  server = spawn(process.execPath, [path.resolve(import.meta.dirname, 'index.js')], {
    env: {
      ...process.env, PORT: String(API_PORT), DB_FILE: path.join(dir, 't.db'), JWT_SECRET: 'test-secret', SMTP_HOST: '',
      RATE_LIMIT_SCALE: '10', TELEGRAM_BOT_TOKEN: '123:abc', TELEGRAM_API_BASE: `http://localhost:${TG_PORT}`,
    },
  });
  server.stdout.on('data', (d) => { log += d; });
  server.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 80; i++) { if (log.includes('phone sign-up is on')) return; await new Promise((r) => setTimeout(r, 100)); }
  throw new Error('server did not start:\n' + log);
});
after(() => { server.kill(); fake.close(); fake.closeAllConnections?.(); setTimeout(() => rmSync(dir, { recursive: true, force: true }), 300); });

const call = async (method, url, { token, body, params } = {}) => {
  const qs = params ? '?' + new URLSearchParams(params) : '';
  const res = await fetch(BASE + url + qs, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

// Walk a sign-up up to the "verified" state; returns the session token
async function verifyPhone(tgUser, phone, role = 'customer') {
  const start = await call('POST', '/auth/phone/start', { body: { role } });
  assert.equal(start.status, 201);
  deliver(startMsg(tgUser, start.data.token));
  await settle();
  deliver(contactMsg(tgUser, phone));
  await settle();
  return start.data.token;
}

test('config and start', async () => {
  assert.equal((await call('GET', '/auth/phone/config')).data.enabled, true);
  assert.equal((await call('POST', '/auth/phone/start', { body: { role: 'admin' } })).status, 400);
  const s = await call('POST', '/auth/phone/start', { body: { role: 'owner' } });
  assert.equal(s.status, 201);
  assert.ok(s.data.link.startsWith('https://t.me/TestBot?start='));
  assert.ok(s.data.link.endsWith(s.data.token));
  assert.equal((await call('GET', '/auth/phone/status', { params: { token: s.data.token } })).data.status, 'waiting');
  assert.equal((await call('GET', '/auth/phone/status', { params: { token: 'nope' } })).data.status, 'expired');
  assert.equal((await call('POST', '/auth/phone/complete', { body: { token: s.data.token, password: 'password123' } })).status, 400, 'cannot finish before verifying');
});

test('full sign-up: share number in Telegram, set a password, log in', async () => {
  const start = await call('POST', '/auth/phone/start', { body: { role: 'owner' } });
  const token = start.data.token;

  deliver(startMsg(111, token));
  await settle();
  const prompt = lastSentTo(111);
  assert.ok(prompt.reply_markup.keyboard[0][0].request_contact, 'bot asks for the contact with a button');

  // someone else's contact card is refused
  deliver(contactMsg(111, '919000000009', 999));
  await settle();
  assert.match(lastSentTo(111).text, /your own number/);
  assert.equal((await call('GET', '/auth/phone/status', { params: { token } })).data.status, 'waiting');

  deliver(contactMsg(111, '919876543210'));
  await settle();
  assert.match(lastSentTo(111).text, /Verified/);
  const status = await call('GET', '/auth/phone/status', { params: { token } });
  assert.equal(status.data.status, 'verified');
  assert.equal(status.data.phone_last4, '3210');

  assert.equal((await call('POST', '/auth/phone/complete', { body: { token, password: 'short' } })).status, 400);
  const done = await call('POST', '/auth/phone/complete', { body: { token, password: 'password123' } });
  assert.equal(done.status, 201);
  assert.equal(done.data.user.phone, '+919876543210');
  assert.equal(done.data.user.phone_verified, true);
  assert.equal(done.data.user.email, null);
  assert.equal(done.data.user.role, 'owner');
  assert.equal(done.data.user.full_name, 'Asha', 'name comes from the Telegram profile');
  assert.equal((await call('GET', '/auth/me', { token: done.data.access_token })).status, 200);

  assert.equal((await call('POST', '/auth/phone/complete', { body: { token, password: 'password123' } })).status, 400, 'a sign-up link works once');
  assert.equal((await call('POST', '/auth/login', { body: { identifier: '98765 43210', password: 'password123' } })).status, 200, 'phone + password login');

  // the verified number is the login, so it cannot be swapped out yet; other fields still save
  assert.equal((await call('PATCH', '/auth/me', { token: done.data.access_token, body: { phone: '9123456780' } })).status, 400);
  assert.equal((await call('PATCH', '/auth/me', { token: done.data.access_token, body: { locality: 'Saket', phone: '+919876543210' } })).status, 200);
});

test('a number or Telegram account can only register once', async () => {
  const token = await verifyPhone(111, '919876543210');
  assert.equal((await call('GET', '/auth/phone/status', { params: { token } })).data.status, 'exists');
  assert.match(lastSentTo(111).text, /already registered/);
  assert.equal((await call('POST', '/auth/phone/complete', { body: { token, password: 'password123' } })).status, 400);

  // same number from a different Telegram account
  const t2 = await verifyPhone(222, '919876543210');
  assert.equal((await call('GET', '/auth/phone/status', { params: { token: t2 } })).data.status, 'exists');
});

test('links expire and unknown links are refused', async () => {
  deliver(startMsg(333, 'not-a-real-token'));
  await settle();
  assert.match(lastSentTo(333).text, /expired or was already used/);
  deliver(contactMsg(444, '919111111111'));
  await settle();
  assert.match(lastSentTo(444).text, /Start from the app first/);
});

test('forgot password sends the reset link through Telegram', async () => {
  const before = sent.length;
  assert.equal((await call('POST', '/auth/reset-request', { body: { identifier: '9876543210' } })).status, 200);
  await settle(300);
  assert.equal(sent.length, before + 1);
  const msg = lastSentTo(111);
  assert.match(msg.text, /reset-password\?token=/);
  const resetToken = /token=([a-f0-9]+)/.exec(msg.text)[1];
  assert.equal((await call('POST', '/auth/reset', { body: { resetToken, newPassword: 'newpassword1' } })).status, 200);
  assert.equal((await call('POST', '/auth/login', { body: { identifier: '9876543210', password: 'newpassword1' } })).status, 200);
  assert.equal((await call('POST', '/auth/login', { body: { identifier: '9876543210', password: 'password123' } })).status, 401);

  const unknown = sent.length;
  assert.equal((await call('POST', '/auth/reset-request', { body: { identifier: '9000000002' } })).status, 200);
  await settle(300);
  assert.equal(sent.length, unknown, 'nothing is sent for unknown numbers');
});

test('a verified phone beats an unverified claim made at email sign-up', async () => {
  // an email user typed 9111111111 but never proved it
  const reg = await call('POST', '/auth/register', { body: { email: 'claim@x.com', password: 'password123', phone: '9111111111' } });
  assert.equal(reg.status, 201);
  const code = [...log.matchAll(/To: claim@x\.com\n\[mail:dev\] (\d{6}) is your/g)].at(-1)[1];
  const v = await call('POST', '/auth/verify-otp', { body: { email: 'claim@x.com', otpCode: code } });
  assert.equal(v.data.user.phone_verified, false, 'typed numbers are not verified');

  // the real owner of that number verifies through Telegram
  const token = await verifyPhone(555, '919111111111');
  const done = await call('POST', '/auth/phone/complete', { body: { token, password: 'password123' } });
  assert.equal(done.status, 201);
  assert.equal(done.data.user.phone, '+919111111111');
  const claimant = await call('GET', '/auth/me', { token: v.data.access_token });
  assert.equal(claimant.data.phone, null, "the unverified claim was removed from the email account");
  assert.equal((await call('POST', '/auth/login', { body: { identifier: 'claim@x.com', password: 'password123' } })).status, 200, 'their email login still works');
});
