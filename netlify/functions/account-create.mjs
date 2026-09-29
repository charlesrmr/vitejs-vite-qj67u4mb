import {
  STORE, createSession, hashPassword, json, newId, normalizeEmail,
  nowIso, publicAccount, sanitizeProfile, sha256, validateProfile,
} from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }

  const profile = sanitizeProfile(body?.profile || {});
  const profileError = validateProfile(profile);
  if (profileError) return json({ error: profileError }, 400);

  const password = String(body?.password || '');
  if (password.length < 8) {
    return json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' }, 400);
  }

  const accountKey = `account/${sha256(normalizeEmail(profile.email))}.json`;
  const store = STORE.accounts();
  const existing = await store.get(accountKey, { type: 'json', consistency: 'strong' });
  if (existing) return json({ error: 'Un compte existe déjà avec cet email.' }, 409);

  const passwordData = hashPassword(password);
  const account = {
    id: newId('acct'),
    key: accountKey,
    profile,
    ...passwordData,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await store.setJSON(accountKey, account, { onlyIfNew: true });

  const session = await createSession(account);
  return json({
    ok: true,
    sessionToken: session.token,
    sessionExpiresAt: session.expiresAt,
    account: publicAccount(account),
  }, 201);
};

export const config = { path: '/api/account/create' };
