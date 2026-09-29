import {
  STORE, json, newId, nowIso, requireUser, saveDossier,
} from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const dossier = {
    id: newId('dos'),
    accountId: auth.account.id,
    profile: auth.account.profile,
    status: 'draft',
    files: {},
    analysis: null,
    review: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await saveDossier(dossier);
  return json({ ok: true, dossier }, 201);
};

export const config = { path: '/api/dossier/create' };
