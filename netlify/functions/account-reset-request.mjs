import {
  STORE,
  json,
  newToken,
  normalizeEmail,
  nowIso,
  sha256,
} from '../lib/pilot.mjs';
import { passwordResetEmail, sendPilotEmail } from '../lib/notify.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }

  const email = normalizeEmail(body?.email);
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ ok: true, deliveryAvailable: Boolean(process.env.RESEND_API_KEY && process.env.PILOT_EMAIL_FROM && process.env.PILOT_PUBLIC_URL) });
  }

  const accountKey = `account/${sha256(email)}.json`;
  const account = await STORE.accounts(req).get(accountKey, { type: 'json', consistency: 'strong' });
  const deliveryAvailable = Boolean(
    process.env.RESEND_API_KEY &&
    process.env.PILOT_EMAIL_FROM &&
    process.env.PILOT_PUBLIC_URL
  );

  if (account && deliveryAvailable) {
    const token = newToken();
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await STORE.resets(req).setJSON(`reset/${tokenHash}.json`, {
      accountKey,
      accountId: account.id,
      email,
      createdAt: nowIso(),
      expiresAt,
    });

    await sendPilotEmail(passwordResetEmail(account, token));
  }

  return json({ ok: true, deliveryAvailable });
};

export const config = {
  path: '/api/account/reset-request',
  rateLimit: { windowLimit: 5, windowSize: 300, aggregateBy: ['ip', 'domain'] },
};
