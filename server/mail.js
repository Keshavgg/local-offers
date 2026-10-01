import nodemailer from 'nodemailer';

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;

const transport = SMTP_HOST && (!SMTP_USER || SMTP_PASS)
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 587),
      secure: Number(SMTP_PORT) === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    })
  : null;

// Sends via SMTP when configured; otherwise prints the message to the server
// console so the flow is testable in development.
export const APP_NAME = process.env.APP_NAME || 'Local Offers';

export async function sendMail({ to, subject, text, html }) {
  if (!transport) {
    console.log(`\n[mail:dev] To: ${to}\n[mail:dev] ${subject}\n[mail:dev] ${text}\n`);
    return;
  }
  await transport.sendMail({ from: `"${APP_NAME}" <${MAIL_FROM || SMTP_USER}>`, to, subject, text, html });
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Plain, short layout with a text alternative: keeps spam scores low.
export const layout = (heading, bodyHtml) => `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#222">
<div style="max-width:420px;margin:0 auto;background:#fff;border-radius:8px;padding:28px">
<div style="font-size:14px;color:#888;margin-bottom:16px">${esc(APP_NAME)}</div>
<h1 style="font-size:18px;margin:0 0 16px">${esc(heading)}</h1>${bodyHtml}
<p style="font-size:12px;color:#888;margin:24px 0 0">If you didn't request this, you can ignore this email.</p>
</div></body></html>`;

export const otpEmail = (code) => ({
  subject: `${code} is your ${APP_NAME} verification code`,
  text: `Your ${APP_NAME} verification code is ${code}.

It expires in 10 minutes. Never share this code with anyone.

If you didn't request this, ignore this email.`,
  html: layout('Your verification code', `<p style="font-size:32px;letter-spacing:6px;font-weight:bold;margin:0 0 16px">${esc(code)}</p><p style="font-size:14px;margin:0">It expires in 10 minutes. Never share this code with anyone.</p>`),
});

export const resetEmail = (url) => ({
  subject: `Reset your ${APP_NAME} password`,
  text: `Reset your ${APP_NAME} password using this link (valid for 1 hour):

${url}

If you didn't request this, ignore this email.`,
  html: layout('Reset your password', `<p style="font-size:14px;margin:0 0 20px">Use the button below within 1 hour.</p><a href="${esc(url)}" style="display:inline-block;background:#222;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:14px">Reset password</a><p style="font-size:12px;color:#888;word-break:break-all;margin:16px 0 0">${esc(url)}</p>`),
});
