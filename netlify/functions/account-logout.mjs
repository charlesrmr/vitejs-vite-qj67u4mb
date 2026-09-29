import { STORE, json, requireUser, sha256 } from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  await STORE.sessions(req).delete(`session/${sha256(auth.token)}`);
  return json({ ok: true });
};

export const config = { path: '/api/account/logout', region: 'fra' };
