import { STORE, json, requireAdmin } from './_pilot.mjs';

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Méthode non autorisée.' }, 405);
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return json({ error: 'Identifiant manquant.' }, 400);

  const dossier = await STORE.dossiers().get(`dossier/${id}.json`, {
    type: 'json', consistency: 'strong',
  });
  if (!dossier) return json({ error: 'Dossier introuvable.' }, 404);
  return json({ dossier });
};

export const config = { path: '/api/admin/dossier' };
