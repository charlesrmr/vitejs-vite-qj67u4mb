import {
  STORE,
  json,
  nowIso,
  publicAccount,
  requireUser,
  sanitizeProfile,
  validateProfile,
} from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }

  const requested = sanitizeProfile({ ...(body?.profile || {}), email: auth.account.profile.email });
  const profileError = validateProfile(requested);
  if (profileError) return json({ error: profileError }, 400);

  auth.account.profile = requested;
  auth.account.updatedAt = nowIso();
  await STORE.accounts(req).setJSON(auth.account.key, auth.account);

  const { blobs } = await STORE.dossiers(req).list({ prefix: 'dossier/' });
  for (const blob of blobs) {
    const dossier = await STORE.dossiers(req).get(blob.key, { type: 'json', consistency: 'strong' });
    if (dossier?.accountId !== auth.account.id || dossier.status === 'reviewed') continue;
    dossier.profile = requested;
    dossier.updatedAt = nowIso();
    await STORE.dossiers(req).setJSON(blob.key, dossier);
  }

  return json({ ok: true, account: publicAccount(auth.account) });
};

export const config = { path: '/api/account/update' };
