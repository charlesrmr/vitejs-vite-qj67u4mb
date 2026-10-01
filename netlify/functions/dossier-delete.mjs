import {
  STORE,
  actionKey,
  dossierKey,
  getOwnedDossier,
  getPharmacyId,
  json,
  requireUser,
} from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }
  if (body?.confirm !== 'SUPPRIMER') return json({ error: 'Confirmation de suppression invalide.' }, 400);

  const dossier = await getOwnedDossier(body?.dossierId, auth.account.id, req);
  if (!dossier) return json({ error: 'Dossier introuvable.' }, 404);

  const { blobs: storedFiles } = await STORE.files(req).list({
    prefix: `dossier/${dossier.id}/`,
  });
  for (const blob of storedFiles || []) {
    await STORE.files(req).delete(blob.key);
  }

  const pharmacyId = String(dossier.pharmacyId || getPharmacyId(auth.account) || '');
  if (pharmacyId) {
    const { blobs: actionBlobs } = await STORE.actions(req).list({
      prefix: `pharmacy/${pharmacyId}/action/`,
    });
    for (const blob of actionBlobs || []) {
      const action = await STORE.actions(req).get(blob.key, {
        type: 'json',
        consistency: 'strong',
      });
      if (action?.sourceDossierId !== dossier.id) continue;
      action.sourceDossierId = null;
      action.updatedAt = new Date().toISOString();
      await STORE.actions(req).setJSON(actionKey(pharmacyId, action.id), action);
    }
  }

  await STORE.dossiers(req).delete(dossierKey(dossier.id));
  return json({ ok: true });
};

export const config = { path: '/api/dossier/delete' };
