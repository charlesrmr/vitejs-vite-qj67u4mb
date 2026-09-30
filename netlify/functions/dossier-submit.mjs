import { adminSubmissionEmail, sendPilotEmail } from '../lib/notify.mjs';
import {
  STORE,
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
  if (body?.patientDataConfirmed !== true || !dossier.uploadPrivacyConfirmedAt) {
    return json({
      error: 'La confirmation de confidentialité doit être enregistrée avant l’envoi du dossier.',
    }, 400);
  }

  const context = String(process.env.CONTEXT || '').toLowerCase();
  const allowNonProdEmails =
    String(process.env.PILOT_ALLOW_NONPROD_EMAILS || '').toLowerCase() === 'true';
  const verificationDeliveryEnabled = Boolean(
    process.env.RESEND_API_KEY &&
    process.env.PILOT_EMAIL_FROM &&
    process.env.PILOT_PUBLIC_URL &&
    (!context || context === 'production' || allowNonProdEmails)
  );
  if (verificationDeliveryEnabled && !auth.account.emailVerifiedAt) {
    return json({
      error: "Vérifiez votre adresse email avant d’envoyer le dossier pour relecture.",
      code: 'EMAIL_VERIFICATION_REQUIRED',
    }, 403);
  }

  const configuredLimit = Number(process.env.PILOT_MAX_FOUNDERS || 10);
  const maxFounders = Number.isFinite(configuredLimit)
    ? Math.min(1000, Math.max(1, Math.floor(configuredLimit)))
    : 10;

  const { blobs } = await STORE.dossiers(req).list({ prefix: 'dossier/' });
  const participantAccounts = new Set();
  for (const blob of blobs || []) {
    const item = await STORE.dossiers(req).get(blob.key, {
      type: 'json',
      consistency: 'strong',
    });
    if (item?.accountId && item.status && item.status !== 'draft') {
      participantAccounts.add(item.accountId);
    }
  }

  if (!participantAccounts.has(auth.account.id) && participantAccounts.size >= maxFounders) {
    return json({
      error: `Le cercle fondateur a atteint sa capacité actuelle de ${maxFounders} pharmacies. Votre compte reste actif et votre dossier peut être conservé en brouillon en attendant une prochaine ouverture.`,
      code: 'PILOT_COHORT_FULL',
    }, 403);
  }

  const cleanedAnalysis = cleanAnalysis(body?.analysis || {});
  const hasUsableAnalysis =
    Number.isFinite(cleanedAnalysis.ca) ||
    Number.isFinite(cleanedAnalysis.activity?.days) ||
    cleanedAnalysis.top10.length > 0 ||
    cleanedAnalysis.familles.length > 0;

  if (!hasUsableAnalysis) {
    return json({
      error: "La pré-analyse ne contient aucune donnée exploitable. Vérifiez l'export et le mapping avant l'envoi.",
    }, 400);
  }

  dossier.analysis = cleanedAnalysis;
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
