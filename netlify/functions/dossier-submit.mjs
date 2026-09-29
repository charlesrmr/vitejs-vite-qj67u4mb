import { adminSubmissionEmail, sendPilotEmail } from '../lib/notify.mjs';
import {
  cleanAnalysis,
  getOwnedDossier,
  json,
  nowIso,
  publicDossier,
  requireUser,
  saveDossier,
} from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }

  const dossier = await getOwnedDossier(body?.dossierId, auth.account.id, req);
  if (!dossier) return json({ error: 'Dossier introuvable.' }, 404);
  if (dossier.status !== 'draft') {
    return json({ error: 'Ce dossier a déjà été envoyé pour relecture.' }, 409);
  }
  if (!dossier.files?.ventes?.complete) {
    return json({ error: 'Le fichier activité / ventes doit être enregistré avant l’envoi.' }, 400);
  }
  if (body?.patientDataConfirmed !== true) {
    return json({ error: 'Confirmez que les fichiers ne contiennent aucune donnée nominative patient.' }, 400);
  }

  dossier.analysis = cleanAnalysis(body?.analysis || {});
  dossier.privacyConfirmedAt = nowIso();
  dossier.status = 'submitted';
  dossier.submittedAt = nowIso();
  await saveDossier(dossier, req);
  const notification = await sendPilotEmail(adminSubmissionEmail(dossier));
  dossier.notification = { adminSubmitted: notification.sent === true, attemptedAt: nowIso() };
  await saveDossier(dossier, req);
  return json({ ok: true, dossier: publicDossier(dossier) });
};

export const config = { path: '/api/dossier/submit' };
