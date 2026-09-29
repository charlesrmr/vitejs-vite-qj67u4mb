import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const A4 = [595.28, 841.89];
const MARGIN = 48;
const C = {
  ink: rgb(0.07, 0.10, 0.16),
  muted: rgb(0.40, 0.45, 0.52),
  violet: rgb(0.43, 0.16, 0.85),
  cyan: rgb(0.04, 0.57, 0.70),
  pale: rgb(0.96, 0.95, 1.00),
  line: rgb(0.88, 0.90, 0.93),
  white: rgb(1, 1, 1),
  dark: rgb(0.04, 0.10, 0.16),
};

function safe(value) {
  return String(value ?? '')
    .replace(/[–—]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/€/g, ' EUR')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
}

function money(value) {
  if (!Number.isFinite(value)) return 'N/D';
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(value).replace(/\u202f/g, ' ') + ' EUR';
}

function percent(value) {
  return Number.isFinite(value) ? `${value}%` : 'N/D';
}

function wrap(font, size, text, maxWidth) {
  const words = safe(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let line = words.shift();

  for (const word of words) {
    const candidate = `${line} ${word}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

export async function buildReviewedPdf(dossier) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Pilot'Officine - ${safe(dossier?.profile?.pharmacyName || 'Diagnostic')}`);
  pdf.setAuthor("Pilot'Officine · CRC Pharma");
  pdf.setSubject('Diagnostic de pilotage officinal relu');
  pdf.setCreator("Pilot'Officine");
  pdf.setProducer("Pilot'Officine");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const profile = dossier?.profile || {};
  const analysis = dossier?.analysis || {};
  const review = dossier?.review || {};

  // Cover
  {
    const page = pdf.addPage(A4);
    const { width, height } = page.getSize();

    page.drawRectangle({ x: 0, y: 0, width, height, color: C.dark });
    page.drawRectangle({ x: 0, y: height - 8, width, height: 8, color: C.violet });
    page.drawRectangle({ x: width - 150, y: 0, width: 150, height, color: rgb(0.05, 0.14, 0.22), opacity: 0.55 });

    page.drawText('P', {
      x: MARGIN,
      y: height - 86,
      size: 26,
      font: bold,
      color: C.white,
    });
    page.drawText("PILOT'OFFICINE", {
      x: MARGIN + 32,
      y: height - 80,
      size: 11,
      font: bold,
      color: rgb(0.73, 0.80, 0.88),
    });

    page.drawText('DIAGNOSTIC DIRIGEANT', {
      x: MARGIN,
      y: height - 205,
      size: 10,
      font: bold,
      color: rgb(0.65, 0.55, 0.95),
    });

    const titleLines = wrap(bold, 30, profile.pharmacyName || 'Officine', width - MARGIN * 2 - 50);
    let titleY = height - 250;
    titleLines.forEach((line) => {
      page.drawText(line, { x: MARGIN, y: titleY, size: 30, font: bold, color: C.white });
      titleY -= 36;
    });

    const meta = [profile.city, analysis.periode, profile.lgo || analysis.lgo].filter(Boolean).join(' · ');
    wrap(regular, 11, meta, width - MARGIN * 2).forEach((line, i) => {
      page.drawText(line, { x: MARGIN, y: titleY - 10 - i * 15, size: 11, font: regular, color: rgb(0.67, 0.73, 0.80) });
    });

    page.drawRectangle({ x: MARGIN, y: 230, width: 58, height: 3, color: C.violet });
    page.drawText('Des chiffres aux priorités.', {
      x: MARGIN,
      y: 185,
      size: 21,
      font: bold,
      color: C.white,
    });
    page.drawText('Pré-analyse automatisée · Relecture humaine · Restitution validée', {
      x: MARGIN,
      y: 162,
      size: 9.5,
      font: regular,
      color: rgb(0.67, 0.73, 0.80),
    });
    page.drawText(`Dossier ${safe(dossier.id || '').slice(-12)}`, {
      x: MARGIN,
      y: 58,
      size: 8,
      font: regular,
      color: rgb(0.48, 0.57, 0.66),
    });
  }

  let page = pdf.addPage(A4);
  let y = page.getHeight() - MARGIN;

  const newPage = () => {
    page = pdf.addPage(A4);
    y = page.getHeight() - MARGIN;
    drawRunningHeader();
  };

  const ensure = (needed = 70) => {
    if (y - needed < MARGIN + 22) newPage();
  };

  const drawRunningHeader = () => {
    const { width, height } = page.getSize();
    page.drawText("PILOT'OFFICINE", { x: MARGIN, y: height - 28, size: 7.5, font: bold, color: C.violet });
    page.drawText(safe(profile.pharmacyName || 'Officine'), { x: width - MARGIN - 180, y: height - 28, size: 7.5, font: regular, color: C.muted });
    page.drawLine({ start: { x: MARGIN, y: height - 36 }, end: { x: width - MARGIN, y: height - 36 }, thickness: 0.6, color: C.line });
    y = height - 58;
  };

  const sectionTitle = (eyebrow, title) => {
    ensure(62);
    page.drawText(safe(eyebrow).toUpperCase(), { x: MARGIN, y, size: 7.5, font: bold, color: C.violet });
    y -= 18;
    const lines = wrap(bold, 18, title, page.getWidth() - MARGIN * 2);
    lines.forEach((line) => {
      page.drawText(line, { x: MARGIN, y, size: 18, font: bold, color: C.ink });
      y -= 22;
    });
    y -= 4;
  };

  const paragraph = (text, { size = 10, color = C.muted, gap = 12 } = {}) => {
    const maxWidth = page.getWidth() - MARGIN * 2;
    const paras = safe(text).split(/\n+/).filter((x) => x.trim());
    for (const para of paras) {
      const lines = wrap(regular, size, para, maxWidth);
      ensure(lines.length * (size + 4) + gap);
      for (const line of lines) {
        page.drawText(line, { x: MARGIN, y, size, font: regular, color });
        y -= size + 4;
      }
      y -= gap;
    }
  };

  const itemList = (items = []) => {
    const visible = items.filter((x) => x?.title || x?.body);
    for (let i = 0; i < visible.length; i += 1) {
      const item = visible[i];
      const titleLines = wrap(bold, 10.5, item.title || '', page.getWidth() - MARGIN * 2 - 54);
      const bodyLines = wrap(regular, 9.3, item.body || '', page.getWidth() - MARGIN * 2 - 54);
      const h = 26 + titleLines.length * 13 + bodyLines.length * 12 + (item.metric ? 12 : 0);
      ensure(h + 8);

      page.drawCircle({ x: MARGIN + 12, y: y - 4, size: 11, color: C.pale });
      page.drawText(String(i + 1).padStart(2, '0'), { x: MARGIN + 6, y: y - 7, size: 7.5, font: bold, color: C.violet });

      let itemY = y;
      if (item.metric) {
        const metric = safe(item.metric);
        const mw = bold.widthOfTextAtSize(metric, 8.5);
        page.drawText(metric, { x: page.getWidth() - MARGIN - mw, y: itemY, size: 8.5, font: bold, color: C.violet });
      }

      titleLines.forEach((line) => {
        page.drawText(line, { x: MARGIN + 40, y: itemY, size: 10.5, font: bold, color: C.ink });
        itemY -= 13;
      });
      itemY -= 3;
      bodyLines.forEach((line) => {
        page.drawText(line, { x: MARGIN + 40, y: itemY, size: 9.3, font: regular, color: C.muted });
        itemY -= 12;
      });

      y = itemY - 10;
      page.drawLine({ start: { x: MARGIN + 40, y: y + 4 }, end: { x: page.getWidth() - MARGIN, y: y + 4 }, thickness: 0.5, color: C.line });
      y -= 4;
    }
  };

  drawRunningHeader();

  // KPI strip
  {
    const kpis = [
      ['CA', money(analysis.ca)],
      ['Marge', percent(analysis.marge_pct)],
      ['Stock', money(analysis.stock_eur)],
      ['Stock sans vente', Number.isFinite(analysis.dormant_stock_eur) ? money(analysis.dormant_stock_eur) : (Number.isFinite(analysis.dormants) ? `${analysis.dormants} refs` : 'N/D')],
    ];
    const gap = 8;
    const totalWidth = page.getWidth() - MARGIN * 2;
    const boxWidth = (totalWidth - gap * 3) / 4;
    const boxHeight = 62;
    kpis.forEach(([label, value], index) => {
      const x = MARGIN + index * (boxWidth + gap);
      page.drawRectangle({ x, y: y - boxHeight, width: boxWidth, height: boxHeight, color: rgb(0.98, 0.985, 0.99), borderColor: C.line, borderWidth: 0.7 });
      page.drawText(safe(label).toUpperCase(), { x: x + 10, y: y - 17, size: 6.8, font: bold, color: C.muted });
      const lines = wrap(bold, 12.5, value, boxWidth - 20);
      lines.slice(0, 2).forEach((line, i) => {
        page.drawText(line, { x: x + 10, y: y - 39 - i * 14, size: 12.5, font: bold, color: C.ink });
      });
    });
    y -= boxHeight + 26;
  }

  sectionTitle('Synthèse dirigeant', "Ce qu'il faut retenir");
  paragraph(review.executiveSummary || 'Synthèse en cours de finalisation.');

  sectionTitle('Constats', 'Ce que montrent les données');
  itemList(review.findings || []);

  sectionTitle('Priorités', 'Les 3 sujets à traiter maintenant');
  itemList(review.priorities || []);

  sectionTitle('Plan 30 jours', "Passer des constats à l'action");
  itemList(review.actions || []);

  if (review.missingData) {
    sectionTitle('Pour aller plus loin', 'Données à compléter');
    paragraph(review.missingData);
  }

  // Data quality appendix when relevant
  if (analysis.qualityWarnings?.length) {
    sectionTitle('Périmètre de lecture', 'Points de vigilance sur les données');
    itemList(
      analysis.qualityWarnings.slice(0, 8).map((warning) => ({
        title: 'Contrôle de qualité',
        body: warning,
      }))
    );
  }

  // Footer on all content pages
  const pages = pdf.getPages();
  pages.forEach((p, index) => {
    if (index === 0) return;
    const { width } = p.getSize();
    p.drawLine({ start: { x: MARGIN, y: 32 }, end: { x: width - MARGIN, y: 32 }, thickness: 0.5, color: C.line });
    p.drawText("Pilot'Officine · CRC Pharma · diagnostic relu avant restitution", {
      x: MARGIN,
      y: 18,
      size: 6.8,
      font: regular,
      color: C.muted,
    });
    const pageLabel = `${index} / ${pages.length - 1}`;
    const pw = regular.widthOfTextAtSize(pageLabel, 6.8);
    p.drawText(pageLabel, { x: width - MARGIN - pw, y: 18, size: 6.8, font: regular, color: C.muted });
  });

  return pdf.save();
}
