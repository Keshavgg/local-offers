// Usage: npm run test:mail -- someone@example.com
import { sendMail } from './mail.js';

const to = process.argv[2] || process.env.SMTP_USER;
if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.error('Fill SMTP_USER and SMTP_PASS in .env first.');
  process.exit(1);
}
await sendMail({ to, subject: 'Test email', text: 'If you can read this, email OTP is working.' });
console.log('Sent to', to);
