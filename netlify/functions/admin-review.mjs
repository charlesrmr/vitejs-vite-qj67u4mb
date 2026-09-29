import {
  STORE, json, nowIso, requireAdmin, sanitizeReview, saveDossier,
} from './_pilot.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }
  const id = String(body?.dossierId || '');
  const dossier = await STORE.dossiers().get(`dossier/${id}.json`, {
    type: 'json', consistency: 'strong',
  });
  if (!dossier) return json({ error: 'Dossier introuvable.' }, 404);

  const status = ['submitted', 'in_review', 'reviewed'].includes(body?.status)
    ? body.status
    : 'in_review';

  dossier.review = sanitizeReview(body?.review || {});
  dossier.status = status;
  dossier.reviewedAt = status === 'reviewed' ? nowIso() : dossier.reviewedAt || null;
  await saveDossier(dossier);

  return json({ ok: true, dossier });
};

export const config = { path: '/api/admin/review' };
