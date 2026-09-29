import { STORE, json } from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Méthode non autorisée.' }, 405);

  try {
    await STORE.dossiers(req).list({ prefix: '__health__/' });
    return json({
      ok: true,
      service: 'PilotOfficine',
      storage: 'ready',
      adminConfigured: Boolean(process.env.PILOT_ADMIN_TOKEN),
      checkedAt: new Date().toISOString(),
    });
  } catch {
    return json({
      ok: false,
      service: 'PilotOfficine',
      storage: 'unavailable',
      adminConfigured: Boolean(process.env.PILOT_ADMIN_TOKEN),
    }, 503);
  }
};

export const config = { path: '/api/health' };
