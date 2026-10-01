import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const file = process.env.DB_FILE || path.resolve(import.meta.dirname, '../data/app.db');
mkdirSync(path.dirname(file), { recursive: true });

export const db = new DatabaseSync(file);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  -- email is optional: people can also sign up with a phone number verified through Telegram
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    full_name TEXT,
    phone TEXT,
    phone_verified INTEGER NOT NULL DEFAULT 0,
    telegram_id TEXT UNIQUE,
    locality TEXT,
    role TEXT NOT NULL DEFAULT 'customer',
    password_hash TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    created_date TEXT NOT NULL
  );

  -- pending phone sign-ups waiting for the person to share their number with the Telegram bot
  CREATE TABLE IF NOT EXISTS phone_signups (
    token_hash TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    telegram_id TEXT,
    first_name TEXT,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'waiting',   -- waiting | started | verified | exists
    expires_at INTEGER NOT NULL
  );

  -- one-time codes (email verification) and reset tokens; only hashes are stored
  CREATE TABLE IF NOT EXISTS tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,            -- 'otp' | 'reset'
    token_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS tokens_user_kind ON tokens(user_id, kind);

  CREATE TABLE IF NOT EXISTS saved (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id TEXT NOT NULL,
    created_date TEXT NOT NULL,
    PRIMARY KEY (user_id, business_id)
  );

  -- Business / Offer / Review documents
  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    entity TEXT NOT NULL,
    owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    data TEXT NOT NULL,
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS records_entity ON records(entity, created_date DESC);
`);

// Migration: account type ('customer' | 'owner') added after the first release
if (!db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === 'role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'customer'");
}

// Migration: older databases required an email and had no Telegram columns. Rebuild the table
// (SQLite can't drop NOT NULL in place) with foreign keys off, as the SQLite docs recommend.
{
  const cols = db.prepare('PRAGMA table_info(users)').all();
  if (cols.find((c) => c.name === 'email')?.notnull) {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN');
    try {
      db.exec(`CREATE TABLE users_new (
        id TEXT PRIMARY KEY, email TEXT UNIQUE, full_name TEXT, phone TEXT,
        phone_verified INTEGER NOT NULL DEFAULT 0, telegram_id TEXT UNIQUE, locality TEXT,
        role TEXT NOT NULL DEFAULT 'customer', password_hash TEXT NOT NULL,
        verified INTEGER NOT NULL DEFAULT 0, created_date TEXT NOT NULL)`);
      db.exec(`INSERT INTO users_new (id, email, full_name, phone, locality, role, password_hash, verified, created_date)
               SELECT id, email, full_name, phone, locality, role, password_hash, verified, created_date FROM users`);
      db.exec('DROP TABLE users');
      db.exec('ALTER TABLE users_new RENAME TO users');
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    } finally {
      db.exec('PRAGMA foreign_keys = ON');
    }
  }
}

// Phone numbers are login IDs: empty means "none", and each number belongs to one account
db.exec("UPDATE users SET phone = NULL WHERE phone = ''");
try {
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_phone ON users(phone) WHERE phone IS NOT NULL');
} catch {
  console.warn('Could not enforce unique phone numbers: existing accounts share a number.');
}
