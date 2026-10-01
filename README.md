# Local Offers

A React + Vite app for discovering local businesses and offers, with an Express + SQLite API.
There are two account types: **customers** (browse, save, review) and **shop owners** (list places, run offers, reply to reviews).

## Run

```bash
npm install
npm run dev
```

This starts the API on http://localhost:3001 and the app on http://localhost:5173 (which proxies `/api`).
Requires Node 22.5+ (uses the built-in `node:sqlite`).

| Command | What it does |
|---|---|
| `npm run dev` | API + app with hot reload |
| `npm test` | API tests on a throwaway database (auth, roles, validation, ratings, offers) |
| `npm run seed` | Optional: add demo places, offers and reviews (`npm run seed -- --remove` deletes them) |
| `npm run build` then `npm start` | Production: the API serves the built app on http://localhost:3001 |

## Rules the server enforces

- Only **shop owners** can list a place; only the owner of a place can edit it, delete it, or add offers to it.
- A place's rating is calculated from its reviews on the server. One review per person per place; owners can't review their own place but can reply to reviews.
- Offers show as live only between their start and end dates and while not paused.
- Saved places belong to each user's account.
- Inputs are validated (lengths, phone numbers, opening hours, offer settings) and unknown fields are dropped.

## Accounts and email

People sign up with an email (verified by a 6-digit code) and can add a phone number. They can then log in with **either the email or the phone number** plus their password. Phone numbers are not verified by SMS (that costs money), so the email is the verified identity. "Forgot password" also accepts a phone number and emails the reset link to the account.

## Phone sign-up with Telegram (free, no email needed)

When `TELEGRAM_BOT_TOKEN` is set, the sign-up page gets a **Phone (Telegram)** tab. The person opens your bot, taps **Share my phone number**, and Telegram vouches for the number (the bot rejects forwarded contact cards). They then choose a password and log in later with their number. "Forgot password" for these accounts sends the reset link through the same bot.

1. In Telegram, message **@BotFather**, send `/newbot`, pick a name and a username ending in `bot`.
2. Copy the token it gives you into `.env` as `TELEGRAM_BOT_TOKEN=...` and restart `npm run dev`.
3. The API console prints `Telegram bot @yourbot ready`. Without the token, the tab is simply hidden.

The bot uses long polling, so it works on localhost with no public URL.

## Email (sign-up codes, password reset)

Copy `.env.example` to `.env`. Without `SMTP_*` settings, codes and reset links are **printed in the API console**.
For Gmail: turn on 2-Step Verification, create an app password, then set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`,
`SMTP_USER`, `SMTP_PASS` (the app password) and `MAIL_FROM`. Check it with `npm run test:mail -- you@example.com`.
Set a long random `JWT_SECRET` in production.

## Layout

- `server/index.js` REST API · `server/db.js` SQLite schema (`data/app.db`, git-ignored) · `server/mail.js` email
- `src/api/client.js` browser client · `src/pages` screens · `src/components/workspace` app components
