import { clearAdminSessionCookie, json } from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  return json({ ok: true }, 200, { 'set-cookie': clearAdminSessionCookie() });
};

export const config = {
  path: '/api/admin/logout',
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
