import { getOwnedDossier, json, requireUser } from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Méthode non autorisée.' }, 405);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const id = new URL(req.url).searchParams.get('id');
  const dossier = await getOwnedDossier(id, auth.account.id);
  if (!dossier) return json({ error: 'Dossier introuvable.' }, 404);
  return json({ dossier });
};

export const config = { path: '/api/dossier' };
