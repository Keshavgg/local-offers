// Free phone verification through a Telegram bot.
//
// The person taps "Continue with Telegram" in the app, opens our bot, and shares their own
// contact with the "Share my phone number" button. Telegram vouches for that number, so no SMS
// is needed. The bot runs by long polling, so it works on localhost without a public URL.
import crypto from 'node:crypto';
import { db } from './db.js';
import { normPhone } from './phone.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const BASE = `${process.env.TELEGRAM_API_BASE || 'https://api.telegram.org'}/bot${TOKEN}`;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let botUsername = null;
export const telegramEnabled = () => !!botUsername;
export const signupLink = (token) => `https://t.me/${botUsername}?start=${token}`;

async function call(method, body = {}) {
  const res = await fetch(`${BASE}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!json.ok) throw new Error(json.description || `Telegram ${method} failed (${res.status})`);
  return json.result;
}

export const sendTelegram = (chatId, text, extra = {}) => call('sendMessage', { chat_id: chatId, text, ...extra });

async function handleUpdate(update) {
  const msg = update.message;
  if (!msg || msg.chat?.type !== 'private') return;
  const chat = msg.chat.id;
  const from = String(msg.from.id);
  const say = (text, extra) => sendTelegram(chat, text, extra).catch((e) => console.error('Telegram send failed:', e.message));

  if (msg.text?.startsWith('/start')) {
    const token = msg.text.split(/\s+/)[1];
    const row = token && db.prepare('SELECT * FROM phone_signups WHERE token_hash = ? AND expires_at > ?').get(sha(token), Date.now());
    if (!row || row.status === 'verified' || row.status === 'exists') {
      return say('This sign-up link has expired or was already used. Go back to the app and start again.');
    }
    db.prepare("UPDATE phone_signups SET telegram_id = ?, first_name = ?, status = 'started' WHERE token_hash = ?")
      .run(from, String(msg.from.first_name || '').slice(0, 60), row.token_hash);
    return say('Tap the button below to share your phone number and finish signing up.', {
      reply_markup: { keyboard: [[{ text: 'Share my phone number', request_contact: true }]], one_time_keyboard: true, resize_keyboard: true },
    });
  }

  if (msg.contact) {
    // Telegram lets people forward any contact card; only accept the sender's own number.
    if (String(msg.contact.user_id) !== from) return say('Please share your own number using the button, not a contact card.');
    const row = db.prepare("SELECT * FROM phone_signups WHERE telegram_id = ? AND status = 'started' AND expires_at > ? ORDER BY expires_at DESC").get(from, Date.now());
    if (!row) return say('Start from the app first: open the sign-up page and tap "Continue with Telegram".');
    const phone = normPhone('+' + String(msg.contact.phone_number).replace(/\D/g, ''));
    if (!phone) return say("Sorry, that number doesn't look valid.");
    const taken = db.prepare('SELECT 1 FROM users WHERE verified = 1 AND (telegram_id = ? OR (phone = ? AND phone_verified = 1))').get(from, phone);
    db.prepare('UPDATE phone_signups SET phone = ?, status = ? WHERE token_hash = ?').run(phone, taken ? 'exists' : 'verified', row.token_hash);
    return say(taken ? 'This number is already registered. Go back to the app and log in.' : 'Verified ✅ Go back to the app to finish signing up.', { reply_markup: { remove_keyboard: true } });
  }

  return say('Hi! To sign up, open the app and tap "Continue with Telegram".');
}

export async function startTelegram() {
  if (!TOKEN) return;
  let warned = false;
  while (!botUsername) {
    try {
      botUsername = (await call('getMe')).username;
    } catch (e) {
      if (!warned) console.error(`Telegram bot not ready (${e.message}). Check TELEGRAM_BOT_TOKEN; retrying quietly.`);
      warned = true;
      await sleep(5000);
    }
  }
  console.log(`Telegram bot @${botUsername} ready: phone sign-up is on`);
  let offset = 0;
  for (;;) {
    try {
      const updates = await call('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] });
      for (const u of updates) {
        offset = u.update_id + 1;
        try { await handleUpdate(u); } catch (e) { console.error('Telegram update failed:', e.message); }
      }
    } catch (e) {
      console.error('Telegram polling error:', e.message);
      await sleep(3000);
    }
  }
}
