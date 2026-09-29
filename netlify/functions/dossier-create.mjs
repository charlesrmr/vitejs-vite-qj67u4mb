import {
  STORE, json, newId, nowIso, requireUser, saveDossier,
} from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { blobs } = await STORE.dossiers(req).list({ prefix: 'dossier/' });
  const drafts = [];
  for (const blob of blobs || []) {
    const item = await STORE.dossiers(req).get(blob.key, {
      type: 'json',
      consistency: 'strong',
    });
    if (item?.accountId === auth.account.id && item.status === 'draft') drafts.push(item);
  }

  if (drafts.length) {
    drafts.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const latest = drafts[0];
    const hasFiles = Object.values(latest.files || {}).some((file) => file?.complete);

    if (!hasFiles) {
      return json({ ok: true, dossier: latest, reused: true });
    }

    return json({
      error: 'Un brouillon avec des fichiers existe déjà. Supprimez-le depuis votre espace avant de créer un nouveau diagnostic.',
      existingDraftId: latest.id,
    }, 409);
  }

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
  await saveDossier(dossier, req);
  return json({ ok: true, dossier }, 201);
};

export const config = { path: '/api/dossier/create' };
