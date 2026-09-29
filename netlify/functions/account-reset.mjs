import {
  STORE,
  createSession,
  hashPassword,
  json,
  sha256,
} from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }

  const token = String(body?.token || '');
  const newPassword = String(body?.newPassword || '');
  if (!token || newPassword.length < 8) {
    return json({ error: 'Lien invalide ou mot de passe trop court.' }, 400);
  }

  const key = `reset/${sha256(token)}.json`;
  const reset = await STORE.resets(req).get(key, { type: 'json', consistency: 'strong' });
  if (!reset || !reset.expiresAt || new Date(reset.expiresAt).getTime() < Date.now()) {
    if (reset) {
      try { await STORE.resets(req).delete(key); } catch {}
    }
    return json({ error: 'Ce lien de réinitialisation est invalide ou expiré.' }, 400);
  }

  const account = await STORE.accounts(req).get(reset.accountKey, { type: 'json', consistency: 'strong' });
  if (!account || account.id !== reset.accountId) {
    await STORE.resets(req).delete(key);
    return json({ error: 'Compte introuvable.' }, 404);
  }

  Object.assign(account, hashPassword(newPassword));
  account.updatedAt = new Date().toISOString();
  await STORE.accounts(req).setJSON(account.key, account);

  const { blobs } = await STORE.sessions(req).list({ prefix: 'session/' });
  for (const blob of blobs) {
    const session = await STORE.sessions(req).get(blob.key, { type: 'json', consistency: 'strong' });
    if (session?.accountId === account.id) await STORE.sessions(req).delete(blob.key);
  }

  const { blobs: resetBlobs } = await STORE.resets(req).list({ prefix: 'reset/' });
  for (const blob of resetBlobs) {
    const item = await STORE.resets(req).get(blob.key, { type: 'json', consistency: 'strong' });
    if (item?.accountId === account.id) await STORE.resets(req).delete(blob.key);
  }

  const session = await createSession(account, req);

  return json({
    ok: true,
    sessionToken: session.token,
    sessionExpiresAt: session.expiresAt,
  });
};

export const config = {
  path: '/api/account/reset',
  region: 'fra',
  rateLimit: { windowLimit: 5, windowSize: 300, aggregateBy: ['ip', 'domain'] },
};
