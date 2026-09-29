import { STORE, json, requireAdmin } from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Méthode non autorisée.' }, 405);
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  const { blobs } = await STORE.dossiers(req).list({ prefix: 'dossier/' });
  const dossiers = [];
  for (const blob of blobs) {
    const item = await STORE.dossiers(req).get(blob.key, { type: 'json', consistency: 'strong' });
    if (item) dossiers.push(item);
  }

  dossiers.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return json({
    dossiers: dossiers.map((d) => ({
      id: d.id,
      status: d.status,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      submittedAt: d.submittedAt || null,
      reviewedAt: d.reviewedAt || null,
      profile: d.profile,
      files: d.files,
      analysis: d.analysis ? {
        ca: d.analysis.ca,
        marge_pct: d.analysis.marge_pct,
        stock_eur: d.analysis.stock_eur,
        periode: d.analysis.periode,
      } : null,
    })),
  });
};

export const config = {
  path: '/api/admin/dossiers',
  region: 'fra',
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};