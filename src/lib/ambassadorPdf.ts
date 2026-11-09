import type { PDFFont } from 'pdf-lib';
import type { AmbassadorApplication } from './api.ts';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 52;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function safe(value: string | null | undefined): string {
  // Standard PDF fonts use WinAnsi. Strip characters they cannot encode so a
  // name with an emoji or a non-Latin script cannot break PDF generation.
  return (value ?? '')
    .replace(/\r/g, '')
    .replace(/[^\n\t\x20-\x7E\xA0-\xFF]/g, '')
    .trim();
}

function wrap(text: string, maxChars: number): string[] {
  const paragraphs = safe(text).split('\n');
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of paragraph.split(/\s+/)) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [''];
}

export async function buildAmbassadorApplicationPdf(
  application: AmbassadorApplication
): Promise<Uint8Array> {
  // pdf-lib is only needed when someone actually downloads a PDF, so keep it
  // out of the main application bundle.
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const ink = rgb(0.08, 0.07, 0.06);
  const muted = rgb(0.38, 0.35, 0.31);
  const accent = rgb(0.95, 0.55, 0.12);
  let y = PAGE_HEIGHT - MARGIN;

  const text = (
    value: string,
    options: { size?: number; font?: PDFFont; color?: typeof ink; x?: number; gap?: number } = {}
  ) => {
    const size = options.size ?? 10;
    const font = options.font ?? regular;
    const color = options.color ?? ink;
    const x = options.x ?? MARGIN;
    page.drawText(safe(value), { x, y, size, font, color });
    y -= options.gap ?? size + 5;
  };

  // Header band.
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 128,
    width: PAGE_WIDTH,
    height: 128,
    color: rgb(0.035, 0.03, 0.025),
  });
  page.drawRectangle({
    x: MARGIN,
    y: PAGE_HEIGHT - 128,
    width: 5,
    height: 128,
    color: accent,
  });
  page.drawText('MHOMHO', {
    x: MARGIN + 18,
    y: PAGE_HEIGHT - 62,
    size: 26,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText('AMBASSADOR APPLICATION', {
    x: MARGIN + 18,
    y: PAGE_HEIGHT - 86,
    size: 11,
    font: bold,
    color: accent,
  });
  page.drawText('Commercial Envoy appointment · Phase 1', {
    x: MARGIN + 18,
    y: PAGE_HEIGHT - 104,
    size: 8.5,
    font: regular,
    color: rgb(0.75, 0.72, 0.68),
  });
  y = PAGE_HEIGHT - 160;

  text('APPLICATION REFERENCE', { size: 8, font: bold, color: muted, gap: 14 });
  text(application.reference, { size: 16, font: bold, gap: 20 });

  text('APPLICANT', { size: 8, font: bold, color: muted, gap: 14 });
  text(application.fullName, { size: 15, font: bold, gap: 18 });

  const details: Array<[string, string]> = [
    ['Email', application.email],
    ['Phone / WhatsApp', application.phone],
    ['Location', [application.city, application.country].filter(Boolean).join(', ')],
    ['Territory', application.territory || 'Not specified'],
    ['Languages', application.languages.join(', ') || 'Not specified'],
    ['Business sectors', application.sectors.join(', ') || 'Not specified'],
    ['Status', application.status.replace(/_/g, ' ')],
  ];

  for (const [label, value] of details) {
    text(label.toUpperCase(), { size: 7.5, font: bold, color: muted, gap: 12 });
    for (const line of wrap(value, 86)) {
      text(line, { size: 10, gap: 14 });
    }
    y -= 3;
  }

  const section = (title: string, body: string) => {
    if (y < 150) return;
    y -= 6;
    text(title.toUpperCase(), { size: 8, font: bold, color: muted, gap: 15 });
    const lines = wrap(body || 'Not provided', 92);
    for (const line of lines) {
      if (y < 90) break;
      text(line, { size: 10, gap: 14 });
    }
  };

  section('Experience', application.experience);
  section('Why MHOMHO', application.motivation);

  const socials = Object.entries(application.socialLinks);
  if (socials.length) {
    y -= 6;
    text('LINKS', { size: 8, font: bold, color: muted, gap: 15 });
    for (const [key, value] of socials) {
      if (y < 80) break;
      text(`${key}: ${value}`, { size: 9, gap: 13 });
    }
  }

  page.drawLine({
    start: { x: MARGIN, y: 54 },
    end: { x: PAGE_WIDTH - MARGIN, y: 54 },
    thickness: 0.5,
    color: rgb(0.82, 0.8, 0.76),
  });
  page.drawText(
    'Submitted through mhomho.work. This document contains applicant-supplied information.',
    { x: MARGIN, y: 38, size: 7.5, font: regular, color: muted }
  );
  page.drawText(`Generated ${new Date().toLocaleString('en-GB')}`, {
    x: PAGE_WIDTH - MARGIN - 150,
    y: 38,
    size: 7.5,
    font: regular,
    color: muted,
  });

  return pdf.save();
}

export function downloadAmbassadorApplicationPdf(
  bytes: Uint8Array,
  reference: string
): void {
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${reference || 'mhomho-ambassador-application'}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function ambassadorApplicationMailto(application: AmbassadorApplication): string {
  const subject = `MHOMHO Ambassador application — ${application.reference}`;
  const body = [
    'Hello MHOMHO Partnerships,',
    '',
    `Please find attached my MHOMHO Ambassador application (${application.reference}).`,
    '',
    `Name: ${application.fullName}`,
    `Email: ${application.email}`,
    `Phone / WhatsApp: ${application.phone}`,
    `Location: ${application.city}, ${application.country}`,
    '',
    'I have attached the PDF generated by the application page.',
    '',
    'Kind regards,',
    application.fullName,
  ].join('\n');
  return `mailto:partnerships@mhomho.work?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
