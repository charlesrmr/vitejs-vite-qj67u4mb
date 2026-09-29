import {
  STORE,
  createSession,
  hashPassword,
  json,
  requireUser,
  verifyPassword,
} from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }

  const currentPassword = String(body?.currentPassword || '');
  const newPassword = String(body?.newPassword || '');
  if (!verifyPassword(currentPassword, auth.account.passwordSalt, auth.account.passwordHash)) {
    return json({ error: 'Mot de passe actuel incorrect.' }, 401);
  }
  if (newPassword.length < 8) {
    return json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' }, 400);
  }
  if (currentPassword === newPassword) {
    return json({ error: 'Choisissez un mot de passe différent.' }, 400);
  }

  Object.assign(auth.account, hashPassword(newPassword));
  auth.account.updatedAt = new Date().toISOString();
  await STORE.accounts(req).setJSON(auth.account.key, auth.account);

  const { blobs } = await STORE.sessions(req).list({ prefix: 'session/' });
  for (const blob of blobs) {
    const session = await STORE.sessions(req).get(blob.key, { type: 'json', consistency: 'strong' });
    if (session?.accountId === auth.account.id) await STORE.sessions(req).delete(blob.key);
  }

  const session = await createSession(auth.account, req);
  return json({ ok: true, sessionToken: session.token, sessionExpiresAt: session.expiresAt });
};

export const config = {
  path: '/api/account/password',
  rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
