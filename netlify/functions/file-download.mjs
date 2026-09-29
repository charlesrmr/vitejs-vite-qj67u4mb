import {
  STORE, fileChunkKey, getOwnedDossier, json, requireAdmin, requireUser,
} from '../lib/pilot.mjs';

function disposition(name) {
  const ascii = String(name || 'fichier').replace(/[^a-zA-Z0-9._-]+/g, '_');
  return `attachment; filename="${ascii}"`;
}

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Méthode non autorisée.' }, 405);
  const url = new URL(req.url);
  const dossierId = url.searchParams.get('dossierId') || '';
  const slot = url.searchParams.get('slot') || '';
  const adminMode = url.searchParams.get('admin') === '1';

  let dossier;
  if (adminMode) {
    const admin = requireAdmin(req);
    if (admin.error) return admin.error;
    dossier = await STORE.dossiers(req).get(`dossier/${dossierId}.json`, {
      type: 'json', consistency: 'strong',
    });
  } else {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    dossier = await getOwnedDossier(dossierId, auth.account.id, req);
  }

  if (!dossier) return json({ error: 'Dossier introuvable.' }, 404);
  const meta = dossier.files?.[slot];
  if (!meta?.uploadId || !meta.chunkCount) return json({ error: 'Fichier introuvable.' }, 404);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (let i = 0; i < meta.chunkCount; i += 1) {
          const chunk = await STORE.files(req).get(fileChunkKey(dossierId, meta.uploadId, i), {
            type: 'arrayBuffer',
            consistency: 'strong',
          });
          if (!chunk) throw new Error(`Chunk ${i} manquant`);
          controller.enqueue(new Uint8Array(chunk));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': meta.contentType || 'application/octet-stream',
      'content-disposition': disposition(meta.fileName),
      'cache-control': 'private, no-store',
    },
  });
};

export const config = { path: '/api/file/download' };
