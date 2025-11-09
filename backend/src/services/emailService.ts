export async function sendVerificationEmail(email: string, token: string) {
  // Replace with real email provider integration in production
  const verificationLink = `${process.env.APP_BASE_URL || 'http://localhost:5173'}/verify-email?token=${token}`;
  console.info('[emailService] Verification email queued', { email, verificationLink });
}






