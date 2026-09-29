import { json, publicAccount, requireUser } from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Méthode non autorisée.' }, 405);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  return json({ account: publicAccount(auth.account) });
};

export const config = { path: '/api/account/me', region: 'fra' };
