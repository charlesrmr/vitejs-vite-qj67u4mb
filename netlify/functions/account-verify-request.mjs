import {
  STORE,
  json,
  newToken,
  nowIso,
  requireUser,
  sha256,
} from '../lib/pilot.mjs';
import { emailVerificationEmail, sendPilotEmail } from '../lib/notify.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  if (auth.account.emailVerifiedAt) {
    return json({ ok: true, alreadyVerified: true, deliveryAvailable: true });
  }

  const deliveryAvailable = Boolean(
    process.env.RESEND_API_KEY &&
    process.env.PILOT_EMAIL_FROM &&
    process.env.PILOT_PUBLIC_URL
  );
  if (!deliveryAvailable) {
    return json({ ok: true, alreadyVerified: false, deliveryAvailable: false });
  }

  const { blobs } = await STORE.verifications(req).list({ prefix: 'verify/' });
  for (const blob of blobs) {
    const existing = await STORE.verifications(req).get(blob.key, { type: 'json', consistency: 'strong' });
    if (existing?.accountId === auth.account.id) await STORE.verifications(req).delete(blob.key);
  }

  const token = newToken();
  const key = `verify/${sha256(token)}.json`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await STORE.verifications(req).setJSON(key, {
    accountId: auth.account.id,
    accountKey: auth.account.key,
    email: auth.account.profile.email,
    createdAt: nowIso(),
    expiresAt,
  });

  const delivery = await sendPilotEmail(emailVerificationEmail(auth.account, token));
  if (!delivery.sent) {
    await STORE.verifications(req).delete(key);
    return json({ ok: true, alreadyVerified: false, deliveryAvailable: true, sent: false });
  }

  return json({ ok: true, alreadyVerified: false, deliveryAvailable: true, sent: true });
};

export const config = {
  path: '/api/account/verify-request',
  rateLimit: { windowLimit: 5, windowSize: 300, aggregateBy: ['ip', 'domain'] },
};
