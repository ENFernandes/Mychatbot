import { Resend } from 'resend';

const APP_BASE_URL = process.env.APP_BASE_URL || 'https://www.multiproviderai.me';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@multiproviderai.me';
const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME || 'Multiprovider AI';
const RESEND_REPLY_TO = process.env.RESEND_REPLY_TO;
const SUPPORT_INBOX_EMAIL = process.env.SUPPORT_INBOX_EMAIL || 'support@multiproviderai.me';

const resendClient = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

function formatUrl(path: string) {
  const base = APP_BASE_URL.endsWith('/') ? APP_BASE_URL.slice(0, -1) : APP_BASE_URL;
  return `${base}${path}`;
}

function formatFrom() {
  return `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`;
}

async function dispatchEmail(payload: { to: string; subject: string; html: string; text: string }) {
  if (!resendClient) {
    console.warn('[emailService] RESEND_API_KEY not configured. Email skipped.', {
      subject: payload.subject,
      to: payload.to,
    });
    return;
  }

  try {
    const emailPayload: any = {
      from: formatFrom(),
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    };

    if (RESEND_REPLY_TO) {
      emailPayload.reply_to = RESEND_REPLY_TO;
    }

    console.log('[emailService] Sending email', {
      from: formatFrom(),
      to: payload.to,
      subject: payload.subject,
    });

    const result = await resendClient.emails.send(emailPayload);
    
    console.log('[emailService] Email sent successfully', {
      id: result.data?.id,
      to: payload.to,
      subject: payload.subject,
    });

    return result;
  } catch (error: any) {
    console.error('[emailService] Failed to send email via Resend', {
      error: error.message,
      status: error.status,
      response: error.response?.body,
      to: payload.to,
      subject: payload.subject,
    });
    throw error;
  }
}

export async function sendVerificationEmail(email: string, token: string) {
  const verificationLink = formatUrl(`/verify-email?token=${token}`);

  await dispatchEmail({
    to: email,
    subject: 'Confirm your email | Multiprovider AI',
    html: `
      <p>Hello,</p>
      <p>We received your request to create an account on Multiprovider AI.</p>
      <p>Please confirm your email address to activate your account:</p>
      <p><a href="${verificationLink}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Verify email</a></p>
      <p>If the button does not work, copy and paste this link in your browser:<br />
      <a href="${verificationLink}">${verificationLink}</a></p>
      <p>This link expires in 24 hours.</p>
      <p>Thank you,<br/>Multiprovider AI Team</p>
    `,
    text: `Hello,

We received your request to create an account on Multiprovider AI.
To activate your account, open the link below (valid for 24 hours):
${verificationLink}

Thank you,
Multiprovider AI Team`,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetLink = formatUrl(`/reset-password?token=${token}`);

  await dispatchEmail({
    to: email,
    subject: 'Reset your password | Multiprovider AI',
    html: `
      <p>Hello,</p>
      <p>We received a request to reset the password for your Multiprovider AI account.</p>
      <p>Click the button below to create a new password (link valid for 1 hour):</p>
      <p><a href="${resetLink}" style="background:#059669;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Reset password</a></p>
      <p>If the button does not work, copy and paste this link in your browser:<br />
      <a href="${resetLink}">${resetLink}</a></p>
      <p>If you did not request this change, you can safely ignore this message.</p>
      <p>Thank you,<br/>Multiprovider AI Team</p>
    `,
    text: `Hello,

We received a request to reset your Multiprovider AI password.
Create a new password using the link (valid for 1 hour):
${resetLink}

If you did not request this change, you can ignore this email.

Thank you,
Multiprovider AI Team`,
  });
}

export async function sendSupportEmail(params: {
  requestId: string;
  userEmail: string;
  userName: string;
  subject: string;
  category: string;
  message: string;
}) {
  const { requestId, userEmail, userName, subject, category, message } = params;

  await dispatchEmail({
    to: SUPPORT_INBOX_EMAIL,
    subject: `[Support #${requestId}] ${subject}`,
    html: `
      <h2>New Support Request</h2>
      <p><strong>Request ID:</strong> ${requestId}</p>
      <p><strong>From:</strong> ${userName} (${userEmail})</p>
      <p><strong>Category:</strong> ${category}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <hr />
      <h3>Message:</h3>
      <p style="white-space: pre-wrap;">${message}</p>
      <hr />
      <p style="color:#666;font-size:12px;">Reply directly to this email to respond to ${userEmail}</p>
    `,
    text: `New Support Request

Request ID: ${requestId}
From: ${userName} (${userEmail})
Category: ${category}
Subject: ${subject}

Message:
${message}

---
Reply directly to this email to respond to ${userEmail}`,
  });
}







