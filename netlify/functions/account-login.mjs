import {
  STORE, createSession, json, normalizeEmail, publicAccount, sha256, verifyPassword,
} from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }

  const email = normalizeEmail(body?.email);
  const password = String(body?.password || '');
  const key = `account/${sha256(email)}.json`;
  const account = await STORE.accounts(req).get(key, { type: 'json', consistency: 'strong' });

  if (!account || !verifyPassword(password, account.passwordSalt, account.passwordHash)) {
    return json({ error: 'Email ou mot de passe incorrect.' }, 401);
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
  path: '/api/account/login',
  region: 'fra',
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};