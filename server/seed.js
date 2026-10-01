// Optional demo content.   npm run seed            add demo places, offers and reviews
//                          npm run seed -- --remove   delete everything this script added
import crypto from 'node:crypto';
import { db } from './db.js';
import { businesses, reviews } from './seed-data.js';

const DEMO_DOMAIN = '@demo.localoffers.test';
const demoUsers = () => db.prepare('SELECT id FROM users WHERE email LIKE ?').all('%' + DEMO_DOMAIN);

if (process.argv.includes('--remove')) {
  const ids = demoUsers().map((u) => u.id);
  for (const id of ids) {
    db.prepare('DELETE FROM records WHERE owner_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }
  console.log(`Removed demo content (${ids.length} demo accounts).`);
  process.exit(0);
}

if (demoUsers().length) {
  console.log('Demo content already exists. Run `npm run seed -- --remove` first to reseed.');
  process.exit(0);
}

const now = () => new Date().toISOString();
const day = (n) => new Date(Date.now() + n * 864e5).toISOString();
// Demo accounts get random, unknowable passwords: nobody can log in as them.
const mkUser = (name, role) => {
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO users (id, email, full_name, role, password_hash, verified, created_date) VALUES (?, ?, ?, ?, ?, 1, ?)')
    .run(id, `${name.toLowerCase().replace(/\W+/g, '.')}${DEMO_DOMAIN}`, name, role, `${crypto.randomBytes(16).toString('hex')}:${crypto.randomBytes(64).toString('hex')}`, now());
  return id;
};
const insert = (entity, owner, data) => {
  const id = crypto.randomUUID();
  const ts = now();
  db.prepare('INSERT INTO records (id, entity, owner_id, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?)').run(id, entity, owner, JSON.stringify(data), ts, ts);
  return id;
};

const owner = mkUser('Demo Owner', 'owner');
const idMap = {};
for (const { id: demoId, ...b } of businesses) {
  const mine = reviews.filter((r) => r.business_id === demoId);
  idMap[demoId] = insert('Business', owner, {
    ...b,
    owner_name: 'Demo Owner',
    review_count: mine.length,
    rating: mine.length ? Math.round((mine.reduce((s, r) => s + r.rating, 0) / mine.length) * 10) / 10 : 0,
    verified: false,
  });
}
const reviewers = {};
for (const r of reviews) {
  reviewers[r.author] ||= mkUser(r.author.replace('.', ''), 'customer');
  insert('Review', reviewers[r.author], { business_id: idMap[r.business_id], author: r.author, rating: r.rating, body: r.body, date: r.date });
}
const offers = [
  ['demo-1', { title: '30% off up to ₹150', type: 'PERCENT', max_saving_paise: 15000, config: { percent: 30, max_discount: 15000, min_order: 40000 }, terms: 'On bills above ₹400' }],
  ['demo-3', { title: '₹50 off', type: 'FLAT', max_saving_paise: 5000, config: { flat_amount: 5000, min_order: 30000 }, terms: 'On bills above ₹300' }],
  ['demo-4', { title: 'Buy 2 get 1 free', type: 'BOGO', max_saving_paise: 6000, config: { buy_qty: 2, get_qty: 1, item_price: 6000 }, terms: 'On produce items' }],
];
for (const [demoId, o] of offers) insert('Offer', owner, { business_id: idMap[demoId], ...o, starts_at: day(-3), ends_at: day(14), status: 'LIVE' });

console.log(`Added ${businesses.length} places, ${reviews.length} reviews and ${offers.length} offers.`);
