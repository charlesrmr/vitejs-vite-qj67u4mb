import {
  STORE, fileChunkKey, getOwnedDossier, json, nowIso, requireUser, saveDossier,
} from '../lib/pilot.mjs';

const MAX_CHUNK = 4 * 1024 * 1024;
const MAX_FILE = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.pdf', '.csv', '.xlsx', '.xls'];

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
  if (!Number.isInteger(chunkIndex) || !Number.isInteger(chunkCount) || chunkIndex < 0 || chunkCount < 1 || chunkIndex >= chunkCount || chunkCount > 10) {
    return json({ error: 'Découpage du fichier invalide.' }, 400);
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE) {
    return json({ error: 'Fichier trop volumineux. Limite pilote : 25 Mo par fichier.' }, 413);
  }
  const lowerName = fileName.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    return json({ error: 'Format refusé. Utilisez PDF, CSV, XLS ou XLSX.' }, 415);
  }

  const dossier = await getOwnedDossier(dossierId, auth.account.id, req);
  if (!dossier) return json({ error: 'Dossier introuvable.' }, 404);

  const data = await req.arrayBuffer();
  if (!data.byteLength || data.byteLength > MAX_CHUNK) {
    return json({ error: 'Chunk vide ou trop volumineux.' }, 413);
  }

  await STORE.files(req).set(fileChunkKey(dossierId, uploadId, chunkIndex), data, {
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

  const complete = chunkIndex === chunkCount - 1;

  if (complete) {
    dossier.files = dossier.files || {};
    const previous = dossier.files[slot];

    if (previous?.uploadId && previous.uploadId !== uploadId && Number.isInteger(previous.chunkCount)) {
      for (let i = 0; i < previous.chunkCount; i += 1) {
        await STORE.files(req).delete(fileChunkKey(dossierId, previous.uploadId, i));
      }
    }

    dossier.files[slot] = {
      uploadId,
      fileName,
      contentType,
      fileSize,
      chunkCount,
      uploadedChunks: chunkCount,
      uploadedAt: nowIso(),
      complete: true,
    };
    await saveDossier(dossier, req);
  }

  return json({ ok: true, chunkIndex, chunkCount, complete });
};

export const config = { path: '/api/file/upload-chunk' };
