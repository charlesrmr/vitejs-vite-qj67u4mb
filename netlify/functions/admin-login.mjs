import {
  adminSessionCookie,
  adminTokenMatches,
  json,
} from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }

  const token = String(body?.token || '').trim();
  if (!adminTokenMatches(token)) {
    return json({ error: 'Accès administrateur refusé.' }, 401);
  }

  const cookie = adminSessionCookie();
  if (!cookie) {
    return json({ error: 'PILOT_ADMIN_TOKEN non configuré sur Netlify.' }, 503);
  }

  return json({ ok: true }, 200, { 'set-cookie': cookie });
};

export const config = {
  path: '/api/admin/login',
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
