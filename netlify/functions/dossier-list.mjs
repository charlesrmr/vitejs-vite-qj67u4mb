import { STORE, json, requireUser , publicDossier } from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Méthode non autorisée.' }, 405);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { blobs } = await STORE.dossiers().list({ prefix: 'dossier/' });
  const dossiers = [];
  for (const blob of blobs) {
    const item = await STORE.dossiers().get(blob.key, { type: 'json', consistency: 'strong' });
    if (item?.accountId === auth.account.id) dossiers.push(item);
  }
  dossiers.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return json({ dossiers: dossiers.map(publicDossier) });
};

export const config = { path: '/api/dossier/list' };
