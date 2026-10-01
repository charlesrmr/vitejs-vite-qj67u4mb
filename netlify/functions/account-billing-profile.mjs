import {
  STORE,
  json,
  nowIso,
  publicAccount,
  requireUser,
  sanitizeBillingProfile,
} from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Requête invalide.' }, 400);
  }

  const billingProfile = sanitizeBillingProfile(body?.billingProfile || {});

  if (billingProfile.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(billingProfile.email)) {
    return json({ error: 'Adresse email de facturation invalide.' }, 400);
  }
  if (billingProfile.country && billingProfile.country.length !== 2) {
    return json({ error: 'Le pays doit utiliser un code ISO à 2 lettres.' }, 400);
  }

  auth.account.billingProfile = billingProfile;
  auth.account.updatedAt = nowIso();
  await STORE.accounts(req).setJSON(auth.account.key, auth.account);

  return json({
    ok: true,
    account: publicAccount(auth.account),
  });
};

export const config = {
  path: '/api/account/billing-profile',
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
