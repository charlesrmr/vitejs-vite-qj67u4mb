const SESSION_KEY = 'pilot_officine_session';

async function parseResponse(response) {
  const type = response.headers.get('content-type') || '';
  const data = type.includes('application/json')
    ? await response.json()
    : { error: await response.text() };

  if (!response.ok) {
    const error = new Error(data?.error || 'Erreur serveur.');
    error.status = response.status;
    throw error;
  }
  return data;
}

export function getSessionToken() {
  try { return localStorage.getItem(SESSION_KEY) || ''; } catch { return ''; }
}

export function saveSessionToken(token) {
  try {
    if (token) localStorage.setItem(SESSION_KEY, token);
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
}

export async function apiRequest(path, { method = 'GET', token = '', body, headers = {} } = {}) {
  const response = await fetch(path, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parseResponse(response);
}

export async function createAccount(profile, password) {
  return apiRequest('/api/account/create', {
    method: 'POST',
    body: { profile, password },
  });
}

export async function loginAccount(email, password) {
  return apiRequest('/api/account/login', {
    method: 'POST',
    body: { email, password },
  });
}

export async function getMe(token) {
  return apiRequest('/api/account/me', { token });
}

export async function createDossier(token) {
  return apiRequest('/api/dossier/create', { method: 'POST', token, body: {} });
}

export async function listMyDossiers(token) {
  return apiRequest('/api/dossier/list', { token });
}

export async function getDossier(token, dossierId) {
  return apiRequest(`/api/dossier?id=${encodeURIComponent(dossierId)}`, { token });
}

export async function submitDossier(token, dossierId, analysis, patientDataConfirmed) {
  return apiRequest('/api/dossier/submit', {
    method: 'POST',
    token,
    body: { dossierId, analysis, patientDataConfirmed: Boolean(patientDataConfirmed) },
  });
}

async function abortUploadChunks(token, dossierId, uploadId) {
  try {
    await apiRequest('/api/file/upload-abort', {
      method: 'POST',
      token,
      body: { dossierId, uploadId },
    });
  } catch {}
}

export async function uploadFileChunks({
  token,
  dossierId,
  slot,
  file,
  privacyConfirmed = false,
  onProgress,
}) {
  const CHUNK_SIZE = 3 * 1024 * 1024;
  const chunkCount = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
  const uploadId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  try {
    for (let index = 0; index < chunkCount; index += 1) {
      const start = index * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      const chunk = file.slice(start, end);

      const response = await fetch('/api/file/upload-chunk', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/octet-stream',
          'x-dossier-id': dossierId,
          'x-upload-id': uploadId,
          'x-file-slot': slot,
          'x-file-name': encodeURIComponent(file.name),
          'x-file-type': file.type || 'application/octet-stream',
          'x-chunk-index': String(index),
          'x-chunk-count': String(chunkCount),
          'x-file-size': String(file.size),
          'x-privacy-confirmed': privacyConfirmed ? 'true' : 'false',
        },
        body: chunk,
      });
      await parseResponse(response);
      onProgress?.({
        slot,
        uploaded: index + 1,
        total: chunkCount,
        pct: Math.round(((index + 1) / chunkCount) * 100),
      });
    }

    return { uploadId, chunkCount };
  } catch (error) {
    await abortUploadChunks(token, dossierId, uploadId);
    throw error;
  }
}

export async function uploadAllFiles({
  token,
  dossierId,
  files,
  privacyConfirmed = false,
  onProgress,
}) {
  const entries = Object.entries(files).filter(([, file]) => Boolean(file));
  for (let i = 0; i < entries.length; i += 1) {
    const [slot, file] = entries[i];
    await uploadFileChunks({
      token,
      dossierId,
      slot,
      file,
      privacyConfirmed,
      onProgress: (item) => onProgress?.({
        ...item,
        fileIndex: i + 1,
        fileCount: entries.length,
        fileName: file.name,
      }),
    });
  }
}

export function clearSession() {
  saveSessionToken('');
}


export async function deleteDossier(token, dossierId) {
  return apiRequest('/api/dossier/delete', {
    method: 'POST',
    token,
    body: { dossierId, confirm: 'SUPPRIMER' },
  });
}


export async function logoutAccount(token) {
  return apiRequest('/api/account/logout', { method: 'POST', token, body: {} });
}


export async function updateAccount(token, profile) {
  return apiRequest('/api/account/update', {
    method: 'POST',
    token,
    body: { profile },
  });
}

export async function updateBillingProfile(token, billingProfile) {
  return apiRequest('/api/account/billing-profile', {
    method: 'POST',
    token,
    body: { billingProfile },
  });
}


export async function changePassword(token, currentPassword, newPassword) {
  return apiRequest('/api/account/password', {
    method: 'POST',
    token,
    body: { currentPassword, newPassword },
  });
}

export async function deleteAccount(token, password) {
  return apiRequest('/api/account/delete', {
    method: 'POST',
    token,
    body: { password, confirm: 'SUPPRIMER MON COMPTE' },
  });
}


export async function requestPasswordReset(email) {
  return apiRequest('/api/account/reset-request', {
    method: 'POST',
    body: { email },
  });
}

export async function resetPassword(token, newPassword) {
  return apiRequest('/api/account/reset', {
    method: 'POST',
    body: { token, newPassword },
  });
}


export async function downloadReviewedReport(token, dossierId) {
  const response = await fetch(`/api/report/download?id=${encodeURIComponent(dossierId)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error || 'Téléchargement du PDF impossible.');
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/i);
  return {
    blob,
    fileName: match?.[1] || 'diagnostic-pilot-officine.pdf',
  };
}


export async function requestEmailVerification(token) {
  return apiRequest('/api/account/verify-request', {
    method: 'POST',
    token,
    body: {},
  });
}

export async function verifyEmail(token) {
  return apiRequest('/api/account/verify', {
    method: 'POST',
    body: { token },
  });
}
