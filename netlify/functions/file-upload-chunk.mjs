import {
  STORE, fileChunkKey, getOwnedDossier, json, nowIso, requireUser, saveDossier,
} from './_pilot.mjs';

const MAX_CHUNK = 4 * 1024 * 1024;

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const dossierId = req.headers.get('x-dossier-id') || '';
  const uploadId = req.headers.get('x-upload-id') || '';
  const slot = req.headers.get('x-file-slot') || '';
  const fileName = decodeURIComponent(req.headers.get('x-file-name') || 'fichier');
  const contentType = req.headers.get('x-file-type') || 'application/octet-stream';
  const chunkIndex = Number(req.headers.get('x-chunk-index'));
  const chunkCount = Number(req.headers.get('x-chunk-count'));
  const fileSize = Number(req.headers.get('x-file-size'));

  if (!dossierId || !uploadId || !['ventes', 'produits', 'stock'].includes(slot)) {
    return json({ error: 'Métadonnées d’upload invalides.' }, 400);
  }
  if (!Number.isInteger(chunkIndex) || !Number.isInteger(chunkCount) || chunkIndex < 0 || chunkCount < 1 || chunkIndex >= chunkCount) {
    return json({ error: 'Index de chunk invalide.' }, 400);
  }

  const dossier = await getOwnedDossier(dossierId, auth.account.id);
  if (!dossier) return json({ error: 'Dossier introuvable.' }, 404);

  const data = await req.arrayBuffer();
  if (!data.byteLength || data.byteLength > MAX_CHUNK) {
    return json({ error: 'Chunk vide ou trop volumineux.' }, 413);
  }

  await STORE.files().set(fileChunkKey(dossierId, uploadId, chunkIndex), data, {
    metadata: {
      dossierId,
      accountId: auth.account.id,
      uploadId,
      slot,
      fileName,
      contentType,
      chunkIndex,
      chunkCount,
      fileSize,
      uploadedAt: nowIso(),
    },
  });

  dossier.files = dossier.files || {};
  dossier.files[slot] = {
    uploadId,
    fileName,
    contentType,
    fileSize,
    chunkCount,
    uploadedChunks: Math.max(Number(dossier.files?.[slot]?.uploadedChunks || 0), chunkIndex + 1),
    uploadedAt: nowIso(),
    complete: chunkIndex === chunkCount - 1,
  };
  await saveDossier(dossier);

  return json({ ok: true, chunkIndex, chunkCount, complete: chunkIndex === chunkCount - 1 });
};

export const config = { path: '/api/file/upload-chunk' };
