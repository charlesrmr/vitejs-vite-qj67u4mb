import { clientReadyEmail, sendPilotEmail } from '../lib/notify.mjs';
import { STORE, json, nowIso, requireAdmin, saveDossier } from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }

  const id = String(body?.dossierId || '');
  const dossier = await STORE.dossiers(req).get(`dossier/${id}.json`, {
    type: 'json',
    consistency: 'strong',
  });
  if (!dossier) return json({ error: 'Dossier introuvable.' }, 404);
  if (dossier.status !== 'reviewed') {
    return json({ error: 'Le diagnostic doit être validé avant notification.' }, 409);
  }

  const delivery = await sendPilotEmail(clientReadyEmail(dossier));
  dossier.notification = {
    ...(dossier.notification || {}),
    clientReady: delivery.sent === true,
    attemptedAt: nowIso(),
    lastReason: delivery.sent ? null : delivery.reason || 'unknown',
  };
  await saveDossier(dossier, req);

  if (!delivery.sent) {
    return json({
      error: delivery.reason === 'not_configured'
        ? 'Les emails transactionnels ne sont pas configurés.'
        : 'L’email n’a pas pu être envoyé.',
      reason: delivery.reason || null,
    }, 502);
  }

  return json({ ok: true, attemptedAt: dossier.notification.attemptedAt });
};

export const config = {
  path: '/api/admin/notify-client',
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
