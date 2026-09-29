import {
  STORE,
  createSession,
  json,
  nowIso,
  publicAccount,
  sha256,
} from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }
  const token = String(body?.token || '');
  if (!token) return json({ error: 'Lien de vérification invalide.' }, 400);

  const key = `verify/${sha256(token)}.json`;
  const verification = await STORE.verifications(req).get(key, { type: 'json', consistency: 'strong' });
  if (!verification || !verification.expiresAt || new Date(verification.expiresAt).getTime() < Date.now()) {
    if (verification) {
      try { await STORE.verifications(req).delete(key); } catch {}
    }
    return json({ error: 'Ce lien de vérification est invalide ou expiré.' }, 400);
  }

  const account = await STORE.accounts(req).get(verification.accountKey, { type: 'json', consistency: 'strong' });
  if (!account || account.id !== verification.accountId || account.profile.email !== verification.email) {
    await STORE.verifications(req).delete(key);
    return json({ error: 'Compte introuvable ou adresse modifiée.' }, 404);
  }

  account.emailVerifiedAt = nowIso();
  account.updatedAt = nowIso();
  await STORE.accounts(req).setJSON(account.key, account);

  const { blobs } = await STORE.verifications(req).list({ prefix: 'verify/' });
  for (const blob of blobs) {
    const item = await STORE.verifications(req).get(blob.key, { type: 'json', consistency: 'strong' });
    if (item?.accountId === account.id) await STORE.verifications(req).delete(blob.key);
  }

  const session = await createSession(account, req);
  return json({
    ok: true,
    sessionToken: session.token,
    sessionExpiresAt: session.expiresAt,
    account: publicAccount(account),
  });
};

export const config = {
  path: '/api/account/verify',
  rateLimit: { windowLimit: 10, windowSize: 300, aggregateBy: ['ip', 'domain'] },
};
