// Sends emails with Nodemailer over SMTP.
// In development without SMTP settings, the email is printed in the terminal instead.
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { escapeHtml } from '../utils/format.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.emailConfigured) return null;
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE, // true for port 465, false for 587 (STARTTLS)
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

export async function verifyEmailTransport(): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.log(`✉️  Email: SMTP not configured – emails will be ${env.isProduction ? 'SKIPPED (set SMTP_HOST!)' : 'printed in this terminal'}`);
    return;
  }
  try {
    await t.verify();
    console.log(`✉️  Email: SMTP ready (${env.SMTP_HOST})`);
  } catch (error) {
    console.error(`✉️  Email: SMTP login failed – ${(error as Error).message}`);
  }
}

interface MailInput {
  to: string;
  subject: string;
  heading: string;
  paragraphs: string[]; // plain text, escaped automatically
  button?: { label: string; url: string };
  footer?: string;
}

/** Simple, email-client-friendly HTML layout */
function renderHtml({ heading, paragraphs, button, footer }: MailInput): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.6">${escapeHtml(p)}</p>`).join('');
  const cta = button
    ? `<p style="margin:24px 0"><a href="${escapeHtml(button.url)}" style="background:#0f766e;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(button.label)}</a></p>
       <p style="font-size:12px;color:#6b7280;word-break:break-all">If the button does not work, copy this link: ${escapeHtml(button.url)}</p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111827">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="font-weight:800;font-size:20px;color:#0f766e;margin-bottom:16px">EstateHub</div>
    <div style="background:#ffffff;border-radius:12px;padding:28px">
      <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(heading)}</h1>
      ${body}${cta}
    </div>
    <p style="font-size:12px;color:#6b7280;margin-top:16px">${escapeHtml(footer ?? 'You received this email because of activity on your EstateHub account.')}</p>
  </div></body></html>`;
}

function renderText({ heading, paragraphs, button }: MailInput): string {
  return [heading, '', ...paragraphs, ...(button ? ['', `${button.label}: ${button.url}`] : [])].join('\n');
}

/**
 * Sends an email. Never throws: email problems are logged so they do not break the main action
 * (for example, a booking is still saved even if the confirmation email fails).
 * Returns true when the email was handed to the SMTP server.
 */
export async function sendEmail(input: MailInput): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    if (!env.isProduction) {
      console.log('\n──────── ✉️  EMAIL (dev preview – SMTP not configured) ────────');
      console.log(`To: ${input.to}\nSubject: ${input.subject}\n\n${renderText(input)}`);
      console.log('──────────────────────────────────────────────────────────────\n');
    } else {
      console.error(`✉️  Email to ${input.to} skipped: SMTP_HOST is not set.`);
    }
    return false;
  }
  try {
    await t.sendMail({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      text: renderText(input),
      html: renderHtml(input),
    });
    return true;
  } catch (error) {
    console.error(`✉️  Email to ${input.to} failed: ${(error as Error).message}`);
    return false;
  }
}
