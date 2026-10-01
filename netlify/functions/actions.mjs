import {
  STORE,
  actionKey,
  getPharmacyId,
  json,
  newId,
  nowIso,
  publicAction,
  requireUser,
  requireWriteAccess,
  sanitizeActionInput,
} from '../lib/pilot.mjs';

const validActionId = (value) => /^[a-z0-9_]{10,100}$/i.test(String(value || ''));

async function validateSourceDossier(sourceDossierId, auth, pharmacyId, req) {
  if (!sourceDossierId) return { ok: true };

  const dossier = await STORE.dossiers(req).get(`dossier/${sourceDossierId}.json`, {
    type: 'json',
    consistency: 'strong',
  });

  if (
    !dossier ||
    !(
      dossier.accountId === auth.account.id ||
      (dossier.pharmacyId && dossier.pharmacyId === pharmacyId)
    )
  ) {
    return { error: json({ error: 'Diagnostic source introuvable pour cette officine.' }, 400) };
  }

  return { ok: true };
}

async function listActions(pharmacyId, req) {
  const { blobs } = await STORE.actions(req).list({
    prefix: `pharmacy/${pharmacyId}/action/`,
  });

  const actions = [];
  for (const blob of blobs || []) {
    const action = await STORE.actions(req).get(blob.key, {
      type: 'json',
      consistency: 'strong',
    });
    if (action?.pharmacyId === pharmacyId) actions.push(action);
  }

  const statusRank = {
    in_progress: 0,
    todo: 1,
    blocked: 2,
    done: 3,
    canceled: 4,
  };
  const priorityRank = { high: 0, medium: 1, low: 2 };

  actions.sort((a, b) => {
    const statusDelta =
      (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
    if (statusDelta) return statusDelta;

    const aDue = a.dueDate || '9999-12-31';
    const bDue = b.dueDate || '9999-12-31';
    if (aDue !== bDue) return aDue.localeCompare(bDue);

    const priorityDelta =
      (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
    if (priorityDelta) return priorityDelta;

    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
  });

  return actions;
}

export default async (req) => {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const pharmacyId = getPharmacyId(auth.account);

  if (req.method === 'GET') {
    const actions = await listActions(pharmacyId, req);
    return json({
      actions: actions.slice(0, 200).map(publicAction),
      total: actions.length,
    });
  }

  if (req.method === 'POST') {
    const access = requireWriteAccess(auth.account);
    if (access.error) return access.error;

    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Requête invalide.' }, 400);
    }

    const cleaned = sanitizeActionInput(body?.action || body || {});
    if (!cleaned.title) {
      return json({ error: 'Le titre de l’action est requis.' }, 400);
    }

    const sourceCheck = await validateSourceDossier(
      cleaned.sourceDossierId,
      auth,
      pharmacyId,
      req
    );
    if (sourceCheck.error) return sourceCheck.error;

    const now = nowIso();
    const requestedId = String(body?.id || '').trim();

    if (requestedId) {
      if (!validActionId(requestedId)) {
        return json({ error: 'Identifiant d’action invalide.' }, 400);
      }

      const key = actionKey(pharmacyId, requestedId);
      const existing = await STORE.actions(req).get(key, {
        type: 'json',
        consistency: 'strong',
      });
      if (!existing || existing.pharmacyId !== pharmacyId) {
        return json({ error: 'Action introuvable.' }, 404);
      }

      const updated = {
        ...existing,
        ...cleaned,
        id: existing.id,
        pharmacyId,
        createdAt: existing.createdAt,
        updatedAt: now,
        completedAt:
          cleaned.status === 'done'
            ? (existing.completedAt || now)
            : null,
      };
      await STORE.actions(req).setJSON(key, updated);
      return json({ ok: true, action: publicAction(updated) });
    }

    const existingActions = await listActions(pharmacyId, req);
    if (existingActions.length >= 200) {
      return json({
        error: 'Limite de 200 actions atteinte pour cette officine. Archivez ou supprimez des actions avant d’en créer de nouvelles.',
      }, 409);
    }

    const id = newId('act');
    const action = {
      id,
      pharmacyId,
      createdByAccountId: auth.account.id,
      ...cleaned,
      createdAt: now,
      updatedAt: now,
      completedAt: cleaned.status === 'done' ? now : null,
    };

    await STORE.actions(req).setJSON(actionKey(pharmacyId, id), action);
    return json({ ok: true, action: publicAction(action) }, 201);
  }

  if (req.method === 'DELETE') {
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Requête invalide.' }, 400);
    }

    const id = String(body?.id || '').trim();
    if (!validActionId(id)) {
      return json({ error: 'Identifiant d’action invalide.' }, 400);
    }

    const key = actionKey(pharmacyId, id);
    const existing = await STORE.actions(req).get(key, {
      type: 'json',
      consistency: 'strong',
    });
    if (!existing || existing.pharmacyId !== pharmacyId) {
      return json({ error: 'Action introuvable.' }, 404);
    }

    await STORE.actions(req).delete(key);
    return json({ ok: true });
  }

  return json({ error: 'Méthode non autorisée.' }, 405);
};

export const config = {
  path: '/api/actions',
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
