import {
  STORE,
  dossierKey,
  getPharmacyId,
  json,
  requireUser,
  verifyPassword,
} from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }

  if (body?.confirm !== 'SUPPRIMER MON COMPTE') {
    return json({ error: 'Confirmation de suppression invalide.' }, 400);
  }
  if (!verifyPassword(String(body?.password || ''), auth.account.passwordSalt, auth.account.passwordHash)) {
    return json({ error: 'Mot de passe incorrect.' }, 401);
  }

  const { blobs: dossierBlobs } = await STORE.dossiers(req).list({ prefix: 'dossier/' });
  for (const blob of dossierBlobs) {
    const dossier = await STORE.dossiers(req).get(blob.key, { type: 'json', consistency: 'strong' });
    if (dossier?.accountId !== auth.account.id) continue;

    const { blobs: storedFiles } = await STORE.files(req).list({
      prefix: `dossier/${dossier.id}/`,
    });
    for (const storedFile of storedFiles || []) {
      await STORE.files(req).delete(storedFile.key);
    }

    await STORE.dossiers(req).delete(dossierKey(dossier.id));
  }

  const { blobs: resetBlobs } = await STORE.resets(req).list({ prefix: 'reset/' });
  for (const blob of resetBlobs) {
    const reset = await STORE.resets(req).get(blob.key, { type: 'json', consistency: 'strong' });
    if (reset?.accountId === auth.account.id) await STORE.resets(req).delete(blob.key);
  }

  const { blobs: verificationBlobs } = await STORE.verifications(req).list({ prefix: 'verify/' });
  for (const blob of verificationBlobs) {
    const verification = await STORE.verifications(req).get(blob.key, { type: 'json', consistency: 'strong' });
    if (verification?.accountId === auth.account.id) await STORE.verifications(req).delete(blob.key);
  }

  const pharmacyId = getPharmacyId(auth.account);
  const { blobs: actionBlobs } = await STORE.actions(req).list({
    prefix: `pharmacy/${pharmacyId}/action/`,
  });
  for (const blob of actionBlobs || []) {
    await STORE.actions(req).delete(blob.key);
  }

  const { blobs: sessionBlobs } = await STORE.sessions(req).list({ prefix: 'session/' });
  for (const blob of sessionBlobs) {
    const session = await STORE.sessions(req).get(blob.key, { type: 'json', consistency: 'strong' });
    if (session?.accountId === auth.account.id) await STORE.sessions(req).delete(blob.key);
  }

  await STORE.accounts(req).delete(auth.account.key);
  return json({ ok: true });
};

export const config = {
  path: '/api/account/delete',
  rateLimit: { windowLimit: 3, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
