// Run with: npm test
// Starts the API on a throwaway database and exercises auth, roles, validation and data rules.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

const PORT = 3099;
const BASE = `http://localhost:${PORT}/api`;
const dir = mkdtempSync(path.join(tmpdir(), 'lo-test-'));
let server;
let log = '';

before(async () => {
  server = spawn(process.execPath, [path.resolve(import.meta.dirname, 'index.js')], {
    env: { ...process.env, PORT: String(PORT), DB_FILE: path.join(dir, 't.db'), JWT_SECRET: 'test-secret', SMTP_HOST: '', RATE_LIMIT_SCALE: '4' },
  });
  server.stdout.on('data', (d) => { log += d; });
  server.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 50; i++) {
    if (log.includes('listening')) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start:\n' + log);
});
after(() => { server.kill(); setTimeout(() => rmSync(dir, { recursive: true, force: true }), 300); });

const call = async (method, url, { token, body, params } = {}) => {
  const qs = params ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])) : '';
  const res = await fetch(BASE + url + qs, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};
const lastCode = (email) => {
  const hits = [...log.matchAll(/To: (\S+)\n\[mail:dev\] (\d{6}) is your/g)].filter((m) => m[1] === email);
  return hits.at(-1)[2];
};

async function signup(email, role, password = 'password123') {
  assert.equal((await call('POST', '/auth/register', { body: { email, password, role } })).status, 201);
  const out = await call('POST', '/auth/verify-otp', { body: { email, otpCode: lastCode(email) } });
  assert.equal(out.status, 200);
  return { token: out.data.access_token, user: out.data.user };
}

const offerBody = (business_id, over = {}) => ({
  business_id, title: '20% off', type: 'PERCENT', max_saving_paise: 15000,
  config: { percent: 20, max_discount: 15000, min_order: 30000 },
  starts_at: new Date(Date.now() - 864e5).toISOString(), ends_at: new Date(Date.now() + 864e5).toISOString(), status: 'LIVE', ...over,
});

let owner, other, customer, bid;

test('auth: validation, OTP and login', async () => {
  assert.equal((await call('POST', '/auth/register', { body: { email: 'bad', password: 'password123' } })).status, 400);
  assert.equal((await call('POST', '/auth/register', { body: { email: 'a@x.com', password: 'short' } })).status, 400);
  assert.equal((await call('POST', '/auth/register', { body: { email: 'a@x.com', password: 'password123', role: 'admin' } })).status, 400);

  await call('POST', '/auth/register', { body: { email: 'pending@x.com', password: 'password123' } });
  assert.equal((await call('POST', '/auth/verify-otp', { body: { email: 'pending@x.com', otpCode: '000000' } })).status, 400, 'wrong code rejected');
  assert.equal((await call('POST', '/auth/login', { body: { email: 'pending@x.com', password: 'password123' } })).status, 403, 'unverified cannot log in');

  owner = await signup('owner@x.com', 'owner');
  other = await signup('other@x.com', 'owner');
  customer = await signup('cust@x.com', 'customer');
  assert.equal(owner.user.role, 'owner');
  assert.equal(customer.user.role, 'customer');
  assert.equal((await call('POST', '/auth/register', { body: { email: 'owner@x.com', password: 'password123' } })).status, 409, 'duplicate email');
  assert.equal((await call('POST', '/auth/login', { body: { email: 'owner@x.com', password: 'wrong-password' } })).status, 401);
  assert.equal((await call('POST', '/auth/login', { body: { email: 'owner@x.com', password: 'password123' } })).status, 200);
  assert.equal((await call('GET', '/auth/me')).status, 401);
  assert.equal((await call('GET', '/auth/me', { token: 'junk' })).status, 401);
  const upd = await call('PATCH', '/auth/me', { token: customer.token, body: { full_name: 'Asha', locality: 'Saket' } });
  assert.equal(upd.data.full_name, 'Asha');
});

test('auth: OTP is single use and password reset works', async () => {
  const code = lastCode('pending@x.com');
  assert.equal((await call('POST', '/auth/verify-otp', { body: { email: 'pending@x.com', otpCode: code } })).status, 200);
  assert.equal((await call('POST', '/auth/verify-otp', { body: { email: 'pending@x.com', otpCode: code } })).status, 400, 'code cannot be reused');

  await call('POST', '/auth/reset-request', { body: { email: 'cust@x.com' } });
  assert.equal((await call('POST', '/auth/reset-request', { body: { email: 'nobody@x.com' } })).status, 200, 'same response for unknown email');
  const token = [...log.matchAll(/reset-password\?token=([a-f0-9]+)/g)].at(-1)[1];
  assert.equal((await call('POST', '/auth/reset', { body: { resetToken: token, newPassword: 'newpassword1' } })).status, 200);
  assert.equal((await call('POST', '/auth/reset', { body: { resetToken: token, newPassword: 'another-pass1' } })).status, 400, 'reset token is single use');
  assert.equal((await call('POST', '/auth/login', { body: { email: 'cust@x.com', password: 'password123' } })).status, 401);
  assert.equal((await call('POST', '/auth/login', { body: { email: 'cust@x.com', password: 'newpassword1' } })).status, 200);
});

test('businesses: roles, validation and ownership', async () => {
  const good = { name: 'Test Cafe', entity_type: 'cafe', locality: 'Saket', hours: [{ open: '09:00', close: '22:00', label: 'Daily' }], items: [{ name: 'Latte', price_paise: 15000 }] };
  assert.equal((await call('POST', '/entities/Business', { token: customer.token, body: good })).status, 403, 'customer cannot list');
  assert.equal((await call('POST', '/entities/Business')).status, 401);
  assert.equal((await call('POST', '/entities/Business', { token: owner.token, body: { ...good, name: '' } })).status, 400);
  assert.equal((await call('POST', '/entities/Business', { token: owner.token, body: { ...good, entity_type: 'spaceship' } })).status, 400);
  assert.equal((await call('POST', '/entities/Business', { token: owner.token, body: { ...good, hours: [{ open: '9am', close: '10pm' }] } })).status, 400);
  assert.equal((await call('POST', '/entities/Business', { token: owner.token, body: { ...good, cover_url: 'javascript:alert(1)' } })).status, 400);
  assert.equal((await call('POST', '/entities/Business', { token: owner.token, body: { ...good, phone: 'abc' } })).status, 400);

  const made = await call('POST', '/entities/Business', { token: owner.token, body: { ...good, rating: 5, verified: true, owner_id: 'x' } });
  assert.equal(made.status, 201);
  bid = made.data.id;
  assert.equal(made.data.rating, 0, 'client cannot set rating');
  assert.equal(made.data.verified, false);
  assert.equal(made.data.owner_id, owner.user.id);
  assert.equal(made.data.items[0].price_paise, 15000);

  assert.equal((await call('PATCH', `/entities/Business/${bid}`, { token: other.token, body: { name: 'Hacked' } })).status, 403);
  assert.equal((await call('DELETE', `/entities/Business/${bid}`, { token: other.token })).status, 403);
  const edit = await call('PATCH', `/entities/Business/${bid}`, { token: owner.token, body: { name: 'Renamed', rating: 5 } });
  assert.equal(edit.data.name, 'Renamed');
  assert.equal(edit.data.rating, 0, 'rating not editable');
  assert.equal(edit.data.locality, 'Saket', 'untouched fields kept');
  assert.equal((await call('GET', `/entities/Business/nope`, { token: owner.token })).status, 404);
  assert.equal((await call('GET', '/entities/Secret', { token: owner.token })).status, 404);
});

test('search and queries', async () => {
  const hit = await call('GET', '/entities/Business', { token: customer.token, params: { query: { name: { $regex: 'renam', $options: 'i' } } } });
  assert.equal(hit.data.items.length, 1);
  const literal = await call('GET', '/entities/Business', { token: customer.token, params: { query: { name: { $regex: '.*' } } } });
  assert.equal(literal.data.items.length, 0, 'regex characters are matched literally');
  assert.equal((await call('GET', '/entities/Business/count', { token: customer.token })).data.count, 1);
  const mine = await call('GET', '/entities/Business', { token: owner.token, params: { query: { owner_id: owner.user.id } } });
  assert.equal(mine.data.items.length, 1);
});

test('offers: rules and effective status', async () => {
  assert.equal((await call('POST', '/entities/Offer', { token: customer.token, body: offerBody(bid) })).status, 403);
  assert.equal((await call('POST', '/entities/Offer', { token: other.token, body: offerBody(bid) })).status, 403, "other owner cannot add to someone else's business");
  assert.equal((await call('POST', '/entities/Offer', { token: owner.token, body: offerBody(bid, { title: ' ' }) })).status, 400);
  assert.equal((await call('POST', '/entities/Offer', { token: owner.token, body: offerBody(bid, { type: 'FREE' }) })).status, 400);
  assert.equal((await call('POST', '/entities/Offer', { token: owner.token, body: offerBody(bid, { config: { percent: 150, max_discount: 100 } }) })).status, 400);
  assert.equal((await call('POST', '/entities/Offer', { token: owner.token, body: offerBody(bid, { ends_at: new Date(Date.now() - 9e8).toISOString() }) })).status, 400, 'ends before start');

  const live = await call('POST', '/entities/Offer', { token: owner.token, body: offerBody(bid) });
  assert.equal(live.status, 201);
  assert.equal(live.data.status, 'LIVE');
  const expired = await call('POST', '/entities/Offer', { token: owner.token, body: offerBody(bid, { title: 'Old', starts_at: new Date(Date.now() - 9e8).toISOString(), ends_at: new Date(Date.now() - 8e8).toISOString() }) });
  assert.equal(expired.data.status, 'EXPIRED');
  const future = await call('POST', '/entities/Offer', { token: owner.token, body: offerBody(bid, { title: 'Soon', starts_at: new Date(Date.now() + 8e8).toISOString(), ends_at: new Date(Date.now() + 9e8).toISOString() }) });
  assert.equal(future.data.status, 'SCHEDULED');

  const liveList = await call('GET', '/entities/Offer', { token: customer.token, params: { query: { status: 'LIVE' } } });
  assert.deepEqual(liveList.data.items.map((o) => o.title), ['20% off'], 'expired and scheduled offers are not live');

  const paused = await call('PATCH', `/entities/Offer/${live.data.id}`, { token: owner.token, body: { status: 'PAUSED' } });
  assert.equal(paused.data.status, 'PAUSED');
  assert.equal((await call('GET', '/entities/Offer/count', { token: customer.token, params: { query: { status: 'LIVE' } } })).data.count, 0);
  assert.equal((await call('PATCH', `/entities/Offer/${live.data.id}`, { token: owner.token, body: { status: 'LIVE' } })).data.status, 'LIVE');
  assert.equal((await call('PATCH', `/entities/Offer/${live.data.id}`, { token: other.token, body: { status: 'PAUSED' } })).status, 403);
});

test('reviews: rules, ratings and owner replies', async () => {
  assert.equal((await call('POST', '/entities/Review', { token: owner.token, body: { business_id: bid, rating: 5, body: 'mine' } })).status, 403, "owner can't review own place");
  assert.equal((await call('POST', '/entities/Review', { token: customer.token, body: { business_id: bid, rating: 9, body: 'x' } })).status, 400);
  assert.equal((await call('POST', '/entities/Review', { token: customer.token, body: { business_id: bid, rating: 4.5, body: 'x' } })).status, 400);
  assert.equal((await call('POST', '/entities/Review', { token: customer.token, body: { business_id: bid, rating: 4, body: '' } })).status, 400);
  assert.equal((await call('POST', '/entities/Review', { token: customer.token, body: { business_id: 'missing', rating: 4, body: 'x' } })).status, 400);

  const r1 = await call('POST', '/entities/Review', { token: customer.token, body: { business_id: bid, rating: 4, body: 'Good', author: 'Spoofed', date: '1999-01-01' } });
  assert.equal(r1.status, 201);
  assert.equal(r1.data.author, 'Asha', 'author comes from the account, not the client');
  assert.equal(r1.data.date, new Date().toISOString().slice(0, 10), 'date is set by the server');
  assert.equal((await call('POST', '/entities/Review', { token: customer.token, body: { business_id: bid, rating: 5, body: 'Again' } })).status, 409, 'one review per person');
  const r2 = await call('POST', '/entities/Review', { token: other.token, body: { business_id: bid, rating: 5, body: 'Great' } });
  assert.equal(r2.status, 201);

  let biz = (await call('GET', `/entities/Business/${bid}`, { token: customer.token })).data;
  assert.equal(biz.rating, 4.5);
  assert.equal(biz.review_count, 2);
  assert.equal((await call('GET', '/entities/Review/aggregate', { token: customer.token, params: { avg: 'rating' } })).data.rows[0].avg_rating, 4.5);

  const reply = await call('PATCH', `/entities/Review/${r1.data.id}`, { token: owner.token, body: { reply: 'Thanks!', rating: 1, body: 'edited' } });
  assert.equal(reply.data.reply, 'Thanks!');
  assert.equal(reply.data.rating, 4, 'owner can only change the reply');
  assert.equal(reply.data.body, 'Good');
  const third = await signup('third@x.com', 'customer');
  assert.equal((await call('PATCH', `/entities/Review/${r1.data.id}`, { token: third.token, body: { reply: 'spam' } })).status, 403);

  assert.equal((await call('DELETE', `/entities/Review/${r1.data.id}`, { token: third.token })).status, 403);
  assert.equal((await call('DELETE', `/entities/Review/${r1.data.id}`, { token: customer.token })).status, 200);
  biz = (await call('GET', `/entities/Business/${bid}`, { token: customer.token })).data;
  assert.equal(biz.rating, 5, 'rating recalculated after a review is deleted');
  assert.equal(biz.review_count, 1);
});

test('saved places are private per user', async () => {
  assert.equal((await call('PUT', `/saved/${bid}`)).status, 401);
  assert.equal((await call('PUT', '/saved/missing', { token: customer.token })).status, 404);
  assert.equal((await call('PUT', `/saved/${bid}`, { token: customer.token })).status, 200);
  assert.equal((await call('PUT', `/saved/${bid}`, { token: customer.token })).status, 200, 'saving twice is harmless');
  assert.deepEqual((await call('GET', '/saved', { token: customer.token })).data.ids, [bid]);
  assert.deepEqual((await call('GET', '/saved', { token: other.token })).data.ids, [], "another user's list is separate");
  assert.equal((await call('DELETE', `/saved/${bid}`, { token: customer.token })).status, 200);
  assert.deepEqual((await call('GET', '/saved', { token: customer.token })).data.ids, []);
});

test('deleting a business removes its offers, reviews and saves', async () => {
  await call('PUT', `/saved/${bid}`, { token: customer.token });
  assert.equal((await call('DELETE', `/entities/Business/${bid}`, { token: owner.token })).status, 200);
  assert.equal((await call('GET', '/entities/Offer/count', { token: customer.token })).data.count, 0);
  assert.equal((await call('GET', '/entities/Review/count', { token: customer.token })).data.count, 0);
  assert.deepEqual((await call('GET', '/saved', { token: customer.token })).data.ids, []);
});

test('phone number login', async () => {
  const reg = (email, phone) => call('POST', '/auth/register', { body: { email, password: 'password123', phone } });
  assert.equal((await reg('ph1@x.com', '12345')).status, 400, 'too short');
  assert.equal((await reg('ph1@x.com', 'abcdefghij')).status, 400, 'letters rejected');
  assert.equal((await reg('ph1@x.com', '5123456789')).status, 400, 'Indian mobiles start with 6-9');
  assert.equal((await reg('ph1@x.com', '98765 43210')).status, 201);
  const code = lastCode('ph1@x.com');
  // unverified accounts can't log in, and the response says which email to verify
  const early = await call('POST', '/auth/login', { body: { identifier: '9876543210', password: 'password123' } });
  assert.equal(early.status, 403);
  assert.equal(early.data.email, 'ph1@x.com');
  const verified = await call('POST', '/auth/verify-otp', { body: { email: 'ph1@x.com', otpCode: lastCode('ph1@x.com') || code } });
  assert.equal(verified.status, 200);
  assert.equal(verified.data.user.phone, '+919876543210', 'stored in one canonical format');

  for (const typed of ['9876543210', '98765 43210', '+91 98765-43210', '09876543210', '919876543210']) {
    const r = await call('POST', '/auth/login', { body: { identifier: typed, password: 'password123' } });
    assert.equal(r.status, 200, `login with ${typed}`);
  }
  assert.equal((await call('POST', '/auth/login', { body: { identifier: '9876543210', password: 'wrong-password' } })).status, 401);
  assert.equal((await call('POST', '/auth/login', { body: { identifier: '9123456780', password: 'password123' } })).status, 401, 'unknown number');
  assert.equal((await call('POST', '/auth/login', { body: { email: 'ph1@x.com', password: 'password123' } })).status, 200, 'email still works');

  assert.equal((await reg('ph2@x.com', '+91 98765 43210')).status, 409, 'number already taken');
  assert.equal((await reg('ph3@x.com', '+14155550123')).status, 201, 'international numbers need +');

  // profile: change, clash, clear
  const t = verified.data.access_token;
  assert.equal((await call('PATCH', '/auth/me', { token: t, body: { phone: customer.user.phone || '9123456780' } })).status, 200);
  const taken = await signup('ph4@x.com', 'customer');
  assert.equal((await call('PATCH', '/auth/me', { token: taken.token, body: { phone: '9123456780' } })).status, 409, 'cannot take a number another account uses');
  assert.equal((await call('PATCH', '/auth/me', { token: taken.token, body: { phone: 'nope' } })).status, 400);
  const cleared = await call('PATCH', '/auth/me', { token: t, body: { phone: '' } });
  assert.equal(cleared.data.phone, null);
  assert.equal((await call('POST', '/auth/login', { body: { identifier: '9123456780', password: 'password123' } })).status, 401, 'cleared number no longer logs in');

  // forgot password: reset by phone number, link goes to the account's email
  assert.equal((await call('PATCH', '/auth/me', { token: t, body: { phone: '9876543210' } })).status, 200);
  const before = [...log.matchAll(/reset-password\?token=([a-f0-9]+)/g)].length;
  assert.equal((await call('POST', '/auth/reset-request', { body: { identifier: '98765 43210' } })).status, 200);
  const after = [...log.matchAll(/reset-password\?token=([a-f0-9]+)/g)];
  assert.equal(after.length, before + 1, 'a reset link was sent');
  assert.match(log.slice(log.lastIndexOf('To: ph1@x.com')), /To: ph1@x\.com/, 'sent to the account email');
  assert.equal((await call('POST', '/auth/reset-request', { body: { identifier: '9000000001' } })).status, 200, 'same answer for unknown numbers');
  assert.equal([...log.matchAll(/reset-password\?token=([a-f0-9]+)/g)].length, before + 1, 'nothing sent for unknown numbers');
  assert.equal((await call('POST', '/auth/reset', { body: { resetToken: after.at(-1)[1], newPassword: 'brandnew123' } })).status, 200);
  assert.equal((await call('POST', '/auth/login', { body: { identifier: '9876543210', password: 'brandnew123' } })).status, 200, 'new password works with the phone number');
});

test('rate limiting kicks in on repeated logins', async () => {
  let last;
  for (let i = 0; i < 70; i++) last = await call('POST', '/auth/login', { body: { email: 'nobody@x.com', password: 'x' } });
  assert.equal(last.status, 429);
});
