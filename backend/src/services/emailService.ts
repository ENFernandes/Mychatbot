import { Resend } from 'resend';

const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@multiproviderai.me';
const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME || 'Multiprovider AI';
const RESEND_REPLY_TO = process.env.RESEND_REPLY_TO;

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
    await resendClient.emails.send({
      from: formatFrom(),
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      reply_to: RESEND_REPLY_TO,
    });
  } catch (error) {
    console.error('[emailService] Failed to send email via Resend', { error });
    throw error;
  }
}

export async function sendVerificationEmail(email: string, token: string) {
  const verificationLink = formatUrl(`/verify-email?token=${token}`);

  await dispatchEmail({
    to: email,
    subject: 'Confirme o seu email | Multiprovider AI',
    html: `
      <p>Olá,</p>
      <p>Recebemos o seu pedido de criação de conta na Multiprovider AI.</p>
      <p>Para ativar a sua conta, confirme o seu email no botão abaixo:</p>
      <p><a href="${verificationLink}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;">Verificar email</a></p>
      <p>Se não vê o botão, copie e cole o seguinte link no seu navegador:<br />
      <a href="${verificationLink}">${verificationLink}</a></p>
      <p>Este link expira em 24 horas.</p>
      <p>Obrigado,<br/>Equipa Multiprovider AI</p>
    `,
    text: `Olá,

Recebemos o seu pedido de criação de conta na Multiprovider AI.
Para ativar a sua conta, abra o link abaixo (válido por 24h):
${verificationLink}

Obrigado,
Equipa Multiprovider AI`,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetLink = formatUrl(`/reset-password?token=${token}`);

  await dispatchEmail({
    to: email,
    subject: 'Recupere a sua password | Multiprovider AI',
    html: `
      <p>Olá,</p>
      <p>Recebemos um pedido para redefinir a sua password na Multiprovider AI.</p>
      <p>Clique no botão para criar uma nova password (link válido por 1 hora):</p>
      <p><a href="${resetLink}" style="background:#059669;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;">Redefinir password</a></p>
      <p>Se não vê o botão, copie e cole o seguinte link no seu navegador:<br />
      <a href="${resetLink}">${resetLink}</a></p>
      <p>Se não solicitou esta alteração, pode ignorar este email.</p>
      <p>Obrigado,<br/>Equipa Multiprovider AI</p>
    `,
    text: `Olá,

Recebemos um pedido para redefinir a sua password na Multiprovider AI.
Crie uma nova password através do link (válido por 1 hora):
${resetLink}

Se não solicitou esta alteração, ignore este email.

Obrigado,
Equipa Multiprovider AI`,
  });
}







