import {
  STORE,
  getOwnedDossier,
  json,
  requireAdmin,
  requireUser,
} from '../lib/pilot.mjs';

function safeName(value) {
  return String(value || 'diagnostic-pilot-officine.pdf')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-');
}

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Méthode non autorisée.' }, 405);

  const url = new URL(req.url);
  const dossierId = url.searchParams.get('id') || '';
  const adminMode = url.searchParams.get('admin') === '1';

  let dossier;
  if (adminMode) {
    const admin = requireAdmin(req);
    if (admin.error) return admin.error;
    dossier = await STORE.dossiers(req).get(`dossier/${dossierId}.json`, {
      type: 'json',
      consistency: 'strong',
    });
  } else {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    dossier = await getOwnedDossier(dossierId, auth.account.id, req);
  }

  if (!dossier) return json({ error: 'Dossier introuvable.' }, 404);
  if (dossier.status !== 'reviewed' || !dossier.report?.key) {
    return json({ error: 'Le diagnostic PDF n’est pas encore disponible.' }, 404);
  }

  const bytes = await STORE.files(req).get(dossier.report.key, {
    type: 'arrayBuffer',
    consistency: 'strong',
  });
  if (!bytes) return json({ error: 'Fichier PDF introuvable.' }, 404);

  return new Response(bytes, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${safeName(dossier.report.fileName)}"`,
      'content-length': String(bytes.byteLength),
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
};

export const config = { path: '/api/report/download' };
