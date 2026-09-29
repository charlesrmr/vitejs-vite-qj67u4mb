import {
  STORE, json, nowIso, requireAdmin, sanitizeReview, saveDossier,
} from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }
  const id = String(body?.dossierId || '');
  const dossier = await STORE.dossiers(req).get(`dossier/${id}.json`, {
    type: 'json', consistency: 'strong',
  });
  if (!dossier) return json({ error: 'Dossier introuvable.' }, 404);
  if (dossier.status === 'draft') {
    return json({ error: 'Le titulaire n’a pas encore envoyé ce dossier pour relecture.' }, 409);
  }

  const status = ['submitted', 'in_review', 'reviewed'].includes(body?.status)
    ? body.status
    : 'in_review';

  const review = sanitizeReview(body?.review || {});

  if (status === 'reviewed') {
    const findings = review.findings.filter((item) => item.title || item.body);
    const priorities = review.priorities.filter((item) => item.title || item.body);
    const actions = review.actions.filter((item) => item.title || item.body);
    if (review.executiveSummary.length < 20) {
      return json({ error: 'Ajoutez une synthèse dirigeant avant validation.' }, 400);
    }
    if (findings.length < 1) {
      return json({ error: 'Validez au moins un constat avant restitution.' }, 400);
    }
    if (priorities.length < 3) {
      return json({ error: 'Le diagnostic final doit contenir 3 priorités.' }, 400);
    }
    if (actions.length < 1) {
      return json({ error: 'Ajoutez au moins une action à 30 jours.' }, 400);
    }
  }

  dossier.review = review;
  dossier.status = status;
  dossier.reviewedAt = status === 'reviewed' ? nowIso() : null;
  await saveDossier(dossier, req);

  return json({ ok: true, dossier });
};

export const config = {
  path: '/api/admin/review',
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};