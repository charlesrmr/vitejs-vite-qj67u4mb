import { buildReviewedPdf } from '../lib/report.mjs';
import { clientReadyEmail, sendPilotEmail } from '../lib/notify.mjs';
import {
  STORE, actionKey, json, nowIso, requireAdmin, sanitizeReview, saveDossier,
} from '../lib/pilot.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }
  const id = String(body?.dossierId || '');
  const dossier = await STORE.dossiers(req).get(`dossier/${id}.json`, {
    type: 'json', consistency: 'strong',
  });
  if (!dossier) return json({ error: 'Dossier introuvable.' }, 404);
  if (dossier.status === 'draft') {
    return json({ error: 'Le titulaire n’a pas encore envoyé ce dossier pour relecture.' }, 409);
  }

  const status = ['submitted', 'in_review', 'reviewed'].includes(body?.status)
    ? body.status
    : 'in_review';

  const review = sanitizeReview(body?.review || {});

  if (status === 'reviewed') {
    const findings = review.findings.filter((item) => item.title || item.body);
    const priorities = review.priorities.filter((item) => item.title || item.body);
    const actions = review.actions.filter((item) => item.title || item.body);
    if (review.executiveSummary.length < 20) {
      return json({ error: 'Ajoutez une synthèse dirigeant avant validation.' }, 400);
    }
    if (findings.length < 1) {
      return json({ error: 'Validez au moins un constat avant restitution.' }, 400);
    }
    if (priorities.length < 3) {
      return json({ error: 'Le diagnostic final doit contenir 3 priorités.' }, 400);
    }
    if (actions.length < 1) {
      return json({ error: 'Ajoutez au moins une action à 30 jours.' }, 400);
    }
  }

  const wasReviewed = dossier.status === 'reviewed';
  dossier.review = review;
  dossier.status = status;
  dossier.reviewedAt = status === 'reviewed' ? nowIso() : null;

  if (status !== 'reviewed' && dossier.report?.key) {
    try { await STORE.files(req).delete(dossier.report.key); } catch {}
    dossier.report = null;
  }

  if (status === 'reviewed') {
    try {
      const pdfBytes = await buildReviewedPdf(dossier);
      const reportKey = `dossier/${dossier.id}/report/reviewed.pdf`;
      const arrayBuffer = pdfBytes.buffer.slice(
        pdfBytes.byteOffset,
        pdfBytes.byteOffset + pdfBytes.byteLength
      );
      await STORE.files(req).set(reportKey, arrayBuffer, {
        metadata: {
          dossierId: dossier.id,
          accountId: dossier.accountId,
          contentType: 'application/pdf',
          generatedAt: nowIso(),
        },
      });
      dossier.report = {
        key: reportKey,
        fileName: `diagnostic-pilot-officine-${dossier.id.slice(-8)}.pdf`,
        contentType: 'application/pdf',
        fileSize: pdfBytes.byteLength,
        generatedAt: nowIso(),
      };
    } catch {
      return json({ error: 'La relecture est complète, mais le PDF final n’a pas pu être généré. Le dossier n’a pas été validé.' }, 500);
    }
  }

  await saveDossier(dossier, req);

  if (status === 'reviewed') {
    const pharmacyId = String(dossier.pharmacyId || dossier.accountId || '');
    const attemptedAt = nowIso();

    try {
      if (pharmacyId) {
        const reviewedAt = dossier.reviewedAt || attemptedAt;
        const due = new Date(reviewedAt);
        due.setUTCDate(due.getUTCDate() + 30);
        const dueDate = due.toISOString().slice(0, 10);

        const reviewActions = (review.actions || []).filter(
          (item) => item?.title || item?.body
        );

        for (let index = 0; index < reviewActions.length; index += 1) {
          const item = reviewActions[index];
          const stableSuffix = String(dossier.id).replace(/[^a-z0-9]/gi, '').slice(-20);
          const id = `act_${stableSuffix}_${index + 1}`;
          const key = actionKey(pharmacyId, id);
          const existing = await STORE.actions(req).get(key, {
            type: 'json',
            consistency: 'strong',
          });
          if (existing) continue;

          const action = {
            id,
            pharmacyId,
            createdByAccountId: dossier.accountId,
            title: item.title || 'Action du diagnostic',
            detail: item.body || '',
            ownerName: '',
            dueDate,
            priority: 'medium',
            status: 'todo',
            impactEur: null,
            metricLabel: item.metric || '',
            resultNote: '',
            sourceDossierId: dossier.id,
            createdAt: reviewedAt,
            updatedAt: reviewedAt,
            completedAt: null,
          };
          await STORE.actions(req).setJSON(key, action);
        }

        dossier.actionSync = {
          status: 'seeded',
          attemptedAt,
          count: reviewActions.length,
          reason: null,
        };
      }
    } catch (error) {
      dossier.actionSync = {
        status: 'failed',
        attemptedAt,
        count: 0,
        reason: String(error?.message || 'unknown').slice(0, 300),
      };
    }

    await saveDossier(dossier, req);
  }

  if (status === 'reviewed' && !wasReviewed) {
    const notification = await sendPilotEmail(clientReadyEmail(dossier));
    dossier.notification = {
      ...(dossier.notification || {}),
      clientReady: notification.sent === true,
      attemptedAt: nowIso(),
      lastReason: notification.sent ? null : notification.reason || 'unknown',
    };
    await saveDossier(dossier, req);
  }

  return json({ ok: true, dossier });
};

export const config = {
  path: '/api/admin/review',
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};