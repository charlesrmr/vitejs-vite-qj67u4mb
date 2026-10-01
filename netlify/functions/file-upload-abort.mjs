import {
  STORE,
  getOwnedDossier,
  json,
  requireUser,
} from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }

  const dossierId = String(body?.dossierId || '');
  const uploadId = String(body?.uploadId || '');
  if (
    !/^[a-z0-9_]{10,80}$/i.test(dossierId) ||
    !/^[a-z0-9_-]{8,100}$/i.test(uploadId)
  ) {
    return json({ error: 'Identifiants d’upload invalides.' }, 400);
  }

  const dossier = await getOwnedDossier(dossierId, auth.account.id, req);
  if (!dossier) return json({ error: 'Dossier introuvable.' }, 404);
  if (dossier.status !== 'draft') {
    return json({ error: 'Ce dossier ne peut plus être modifié.' }, 409);
  }

  const prefix = `dossier/${dossierId}/${uploadId}/chunk-`;
  const { blobs } = await STORE.files(req).list({ prefix });

  for (const blob of blobs || []) {
    await STORE.files(req).delete(blob.key);
  }

  return json({ ok: true, deletedChunks: (blobs || []).length });
};

export const config = {
  path: '/api/file/upload-abort',
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
