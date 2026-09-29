import {
  cleanAnalysis, getOwnedDossier, json, nowIso, requireUser, saveDossier,
} from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }

  const dossier = await getOwnedDossier(body?.dossierId, auth.account.id);
  if (!dossier) return json({ error: 'Dossier introuvable.' }, 404);

  dossier.analysis = cleanAnalysis(body?.analysis || {});
  dossier.status = 'submitted';
  dossier.submittedAt = nowIso();
  await saveDossier(dossier);
  return json({ ok: true, dossier });
};

export const config = { path: '/api/dossier/submit' };
