import "server-only";

/** Variables secrètes : ne doivent jamais être importées par un composant client. */
export const serverEnv = {
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "",
  barberNotificationEmail: process.env.BARBER_NOTIFICATION_EMAIL ?? "",
  manageTokenSecret: process.env.MANAGE_TOKEN_SECRET ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",
  rateLimitSalt: process.env.RATE_LIMIT_SALT ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleTokenEncryptionKey: process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? "",
};

export const isEmailConfigured = () => Boolean(serverEnv.resendApiKey && serverEnv.emailFrom);
export const isGoogleConfigured = () =>
  Boolean(serverEnv.googleClientId && serverEnv.googleClientSecret && serverEnv.googleTokenEncryptionKey);
