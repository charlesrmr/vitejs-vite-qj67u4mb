import {
  STORE, fileChunkKey, getOwnedDossier, json, nowIso, requireUser, saveDossier,
} from '../lib/pilot.mjs';

const MAX_CHUNK = 4 * 1024 * 1024;
const MAX_FILE = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.pdf', '.csv', '.xlsx', '.xls'];

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const dossierId = req.headers.get('x-dossier-id') || '';
  const uploadId = req.headers.get('x-upload-id') || '';
  const slot = req.headers.get('x-file-slot') || '';
  let fileName = req.headers.get('x-file-name') || 'fichier';
  try { fileName = decodeURIComponent(fileName); } catch {}
  fileName = String(fileName).replace(/[\r\n]/g, ' ').trim().slice(0, 240) || 'fichier';
  const contentType = req.headers.get('x-file-type') || 'application/octet-stream';
  const chunkIndex = Number(req.headers.get('x-chunk-index'));
  const chunkCount = Number(req.headers.get('x-chunk-count'));
  const fileSize = Number(req.headers.get('x-file-size'));

  if (
    !dossierId ||
    !/^[a-z0-9_]{10,80}$/i.test(dossierId) ||
    !/^[a-z0-9_-]{8,100}$/i.test(uploadId) ||
    !['ventes', 'produits', 'stock'].includes(slot)
  ) {
    return json({ error: 'Métadonnées d’upload invalides.' }, 400);
  }
  if (!Number.isInteger(chunkIndex) || !Number.isInteger(chunkCount) || chunkIndex < 0 || chunkCount < 1 || chunkIndex >= chunkCount || chunkCount > 10) {
    return json({ error: 'Découpage du fichier invalide.' }, 400);
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE) {
    return json({ error: 'Fichier trop volumineux. Limite pilote : 25 Mo par fichier.' }, 413);
  }
  const lowerName = fileName.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    return json({ error: 'Format refusé. Utilisez PDF, CSV, XLS ou XLSX.' }, 415);
  }

  const dossier = await getOwnedDossier(dossierId, auth.account.id, req);
  if (!dossier) return json({ error: 'Dossier introuvable.' }, 404);
  if (dossier.status !== 'draft') {
    return json({ error: 'Ce dossier a déjà été envoyé et ne peut plus recevoir de nouveaux fichiers.' }, 409);
  }

  const data = await req.arrayBuffer();
  if (!data.byteLength || data.byteLength > MAX_CHUNK) {
    return json({ error: 'Chunk vide ou trop volumineux.' }, 413);
  }

  if (chunkIndex === 0) {
    const bytes = new Uint8Array(data.slice(0, Math.min(data.byteLength, 512)));
    const ext = ALLOWED_EXTENSIONS.find((item) => lowerName.endsWith(item));
    const starts = (...values) => values.every((value, index) => bytes[index] === value);
    const isPdf = bytes.length >= 5 &&
      bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2D;
    const isZip = starts(0x50, 0x4B, 0x03, 0x04);
    const isOleXls = starts(0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1);
    const isLegacyBiff =
      (bytes[0] === 0x09 && [0x00, 0x02, 0x04, 0x08].includes(bytes[1])) ||
      (bytes[0] === 0x2F && bytes[1] === 0x00);

    const decodeHeader = (encoding) =>
      new TextDecoder(encoding, { fatal: false })
        .decode(bytes)
        .replace(/^\uFEFF/, '')
        .trimStart()
        .toLowerCase();

    const utf8Header = decodeHeader('utf-8');
    const utf16Header = decodeHeader('utf-16le');
    const headers = [utf8Header, utf16Header];

    const isXmlXls = headers.some((headerText) =>
      headerText.startsWith('<?xml') &&
      (headerText.includes('spreadsheet') || headerText.includes('workbook'))
    );
    const isHtmlXls = headers.some((headerText) =>
      (headerText.startsWith('<html') || headerText.startsWith('<!doctype html')) &&
      (headerText.includes('<table') || headerText.includes('mso-'))
    );
    const isSylk = headers.some((headerText) => headerText.startsWith('id;'));
    const isDif = headers.some((headerText) => headerText.startsWith('table'));
    const isXls = isOleXls || isZip || isLegacyBiff || isXmlXls || isHtmlXls || isSylk || isDif;
    const hasNull = bytes.some((value) => value === 0x00);

    if (ext === '.pdf' && !isPdf) return json({ error: 'Le fichier ne correspond pas à un PDF valide.' }, 415);
    if (ext === '.xlsx' && !isZip) return json({ error: 'Le fichier ne correspond pas à un XLSX valide.' }, 415);
    if (ext === '.xls' && !isXls) return json({ error: 'Le fichier ne correspond pas à un format XLS reconnu.' }, 415);
    if (ext === '.csv' && hasNull) return json({ error: 'Le CSV semble contenir des données binaires et a été refusé.' }, 415);
  }

  await STORE.files(req).set(fileChunkKey(dossierId, uploadId, chunkIndex), data, {
    metadata: {
      dossierId,
      accountId: auth.account.id,
      uploadId,
      slot,
      fileName,
      contentType,
      chunkIndex,
      chunkCount,
      fileSize,
      uploadedAt: nowIso(),
    },
  });

  const complete = chunkIndex === chunkCount - 1;

  if (complete) {
    const prefix = `dossier/${dossierId}/${uploadId}/chunk-`;
    const uploaded = await STORE.files(req).list({ prefix });
    if ((uploaded.blobs || []).length !== chunkCount) {
      return json({ error: 'Upload incomplet : un ou plusieurs morceaux du fichier sont manquants.' }, 409);
    }

    let actualSize = 0;
    for (let i = 0; i < chunkCount; i += 1) {
      const stored = await STORE.files(req).get(fileChunkKey(dossierId, uploadId, i), {
        type: 'arrayBuffer',
        consistency: 'strong',
      });
      if (!stored) return json({ error: `Upload incomplet : morceau ${i + 1}/${chunkCount} manquant.` }, 409);
      actualSize += stored.byteLength;
    }
    if (actualSize !== fileSize) {
      return json({ error: 'La taille reçue ne correspond pas au fichier annoncé.' }, 409);
    }

    dossier.files = dossier.files || {};
    const previous = dossier.files[slot];

    if (previous?.uploadId && previous.uploadId !== uploadId && Number.isInteger(previous.chunkCount)) {
      for (let i = 0; i < previous.chunkCount; i += 1) {
        await STORE.files(req).delete(fileChunkKey(dossierId, previous.uploadId, i));
      }
    }

    dossier.files[slot] = {
      uploadId,
      fileName,
      contentType,
      fileSize,
      chunkCount,
      uploadedChunks: chunkCount,
      uploadedAt: nowIso(),
      complete: true,
    };
    await saveDossier(dossier, req);
  }

  return json({ ok: true, chunkIndex, chunkCount, complete });
};

export const config = { path: '/api/file/upload-chunk' };
