import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  GUIDE_EDITION,
  GUIDE_SECTIONS,
  GUIDE_STATS,
  GUIDE_SUPPORT_EMAIL,
  type GuideBlock,
} from '../src/content/creatorGuide.ts';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(projectRoot, 'public', 'download');
const outputPdf = path.join(outputDir, 'mhomho-creator-guide.pdf');
const iconPath = path.join(projectRoot, 'public', 'icon-512.png');

const chromeCandidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

const chrome = chromeCandidates.find((candidate) => existsSync(candidate));
if (!chrome) {
  throw new Error('Chrome or Edge was not found. Install one to generate the guide PDF.');
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderBlock = (block: GuideBlock): string => {
  if (block.type === 'paragraph') {
    return `<p class="copy">${escapeHtml(block.text)}</p>`;
  }

  if (block.type === 'cards') {
    return `<div class="cards">${block.items
      .map(
        (item, index) => `<article class="card">
          <div class="card-top"><span>${escapeHtml(item.tag ?? `0${index + 1}`)}</span><span class="arrow">↗</span></div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.body)}</p>
        </article>`,
      )
      .join('')}</div>`;
  }

  if (block.type === 'steps') {
    return `<ol class="steps">${block.items
      .map(
        (item, index) => `<li>
          <span class="step-number">${String(index + 1).padStart(2, '0')}</span>
          <span class="step-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(
            item.body,
          )}</span></span>
        </li>`,
      )
      .join('')}</ol>`;
  }

  if (block.type === 'checklist') {
    return `<div class="checklist">
      <div class="check-card do"><div class="check-label"><span>✓</span> Do this</div><ul>${block.do
        .map((item) => `<li><span>✓</span>${escapeHtml(item)}</li>`)
        .join('')}</ul></div>
      <div class="check-card dont"><div class="check-label"><span>×</span> Not this</div><ul>${block.dont
        .map((item) => `<li><span>×</span>${escapeHtml(item)}</li>`)
        .join('')}</ul></div>
    </div>`;
  }

  if (block.type === 'table') {
    return `<table><thead><tr>${block.headers
      .map((header) => `<th>${escapeHtml(header)}</th>`)
      .join('')}</tr></thead><tbody>${block.rows
      .map(
        (row) =>
          `<tr>${row
            .map((cell, index) => `<td class="${index === 0 ? 'strong' : ''}">${escapeHtml(cell)}</td>`)
            .join('')}</tr>`,
      )
      .join('')}</tbody></table>`;
  }

  if (block.type === 'faq') {
    return `<div class="faq">${block.items
      .map(
        (item) => `<div class="faq-item"><h3>${escapeHtml(item.q)}</h3><p>${escapeHtml(
          item.a,
        )}</p></div>`,
      )
      .join('')}</div>`;
  }

  if (block.type === 'hooks') {
    return `<div class="hooks"><p class="eyebrow">Hook starters</p><div class="hook-list">${block.items
      .map((item) => `<span>${escapeHtml(item)}</span>`)
      .join('')}</div></div>`;
  }

  return `<div class="note"><p class="eyebrow">${escapeHtml(block.label)}</p><p>${escapeHtml(
    block.text,
  )}</p></div>`;
};

const iconBase64 = readFileSync(iconPath).toString('base64');
const iconUri = `data:image/png;base64,${iconBase64}`;

const coverStats = GUIDE_STATS.map(
  (stat) => `<div class="stat">
    <strong>${escapeHtml(stat.value)}</strong>
    <span>${escapeHtml(stat.label)}</span>
  </div>`,
).join('');

const sectionPages = GUIDE_SECTIONS.map((section, index) => {
  const blocks = section.blocks.map(renderBlock).join('');
  return `<section class="page inner">
    <div class="page-glow"></div>
    <div class="page-content">
      <div class="doc-head">
        <span class="doc-brand">Mhomho creator guide</span>
        <span class="doc-section">${section.number} / ${escapeHtml(section.eyebrow)}</span>
      </div>
      <div class="section-kicker"><span>${section.number}</span>${escapeHtml(section.eyebrow)}</div>
      <h2>${escapeHtml(section.title)}</h2>
      ${section.intro ? `<p class="intro">${escapeHtml(section.intro)}</p>` : ''}
      <div class="blocks">${blocks}</div>
    </div>
    <div class="doc-foot">
      <span>mhomho.work/creator-guide</span>
      <span>${String(index + 1).padStart(2, '0')} / ${String(GUIDE_SECTIONS.length).padStart(2, '0')}</span>
    </div>
  </section>`;
}).join('');

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Mhomho Creator Guide</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      margin: 0;
      background: #080706;
      color: #F7F4F0;
      font-family: Inter, "Segoe UI", Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.55;
    }
    h1, h2, h3, strong, .stat strong, .step-number, .doc-section, .cover-kicker {
      font-family: "Inter Tight", Inter, "Segoe UI", Arial, sans-serif;
    }
    .page {
      position: relative;
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      page-break-after: always;
      background: #080706;
    }
    .page:last-child { page-break-after: auto; }
    .page-glow {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(42% 30% at 92% 0%, rgba(255, 159, 10, 0.14), transparent 70%),
        radial-gradient(38% 32% at 2% 100%, rgba(240, 25, 27, 0.08), transparent 72%);
      pointer-events: none;
    }
    .page-content { position: relative; z-index: 1; padding: 15mm 16mm 16mm; }
    .doc-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 5mm;
      border-bottom: 0.3mm solid rgba(255,255,255,0.10);
      color: #746D66;
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    .doc-brand { color: #A8A099; }
    .doc-section { color: #FF9F0A; }
    .section-kicker {
      display: flex;
      align-items: center;
      gap: 3mm;
      margin-top: 11mm;
      color: #746D66;
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
    }
    .section-kicker span {
      display: grid;
      width: 9mm;
      height: 9mm;
      place-items: center;
      border: 0.3mm solid rgba(255,159,10,0.35);
      border-radius: 999px;
      background: rgba(255,159,10,0.08);
      color: #FF9F0A;
      font-size: 7pt;
      letter-spacing: 0;
    }
    h2 {
      max-width: 150mm;
      margin: 4mm 0 0;
      font-size: 31pt;
      line-height: 0.98;
      letter-spacing: -0.035em;
      color: #F7F4F0;
    }
    .intro {
      max-width: 145mm;
      margin: 4mm 0 0;
      color: #A8A099;
      font-size: 10pt;
      line-height: 1.65;
    }
    .blocks { margin-top: 8mm; }
    .copy {
      max-width: 164mm;
      margin: 0 0 5mm;
      color: #A8A099;
      font-size: 9.6pt;
      line-height: 1.72;
    }
    .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
    .card {
      break-inside: avoid;
      padding: 5mm;
      border: 0.3mm solid rgba(255,255,255,0.10);
      border-radius: 4mm;
      background: rgba(255,255,255,0.025);
    }
    .card-top { display: flex; justify-content: space-between; color: #FF9F0A; font-size: 6.8pt; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; }
    .arrow { color: #746D66; font-size: 11pt; line-height: 1; }
    .card h3 { margin: 4mm 0 0; font-size: 13.5pt; line-height: 1.08; letter-spacing: -0.025em; }
    .card p { margin: 2mm 0 0; color: #A8A099; font-size: 8.5pt; line-height: 1.55; }
    .steps { list-style: none; margin: 0; padding: 0; }
    .steps li { display: flex; gap: 4mm; margin-bottom: 5mm; break-inside: avoid; }
    .step-number {
      display: grid;
      flex: 0 0 9mm;
      width: 9mm;
      height: 9mm;
      place-items: center;
      border: 0.3mm solid rgba(255,159,10,0.35);
      border-radius: 999px;
      color: #FF9F0A;
      font-size: 7pt;
      font-weight: 700;
    }
    .step-copy { display: block; padding-top: 0.5mm; }
    .step-copy strong { display: block; color: #F7F4F0; font-size: 10pt; }
    .step-copy span { display: block; max-width: 145mm; margin-top: 1mm; color: #A8A099; font-size: 8.8pt; line-height: 1.55; }
    .note {
      break-inside: avoid;
      margin-top: 5mm;
      padding: 4.5mm 5mm;
      border: 0.3mm solid rgba(255,159,10,0.30);
      border-radius: 4mm;
      background: rgba(255,159,10,0.07);
    }
    .note .eyebrow, .hooks .eyebrow {
      margin: 0;
      color: #FF9F0A;
      font-size: 6.8pt;
      font-weight: 700;
      letter-spacing: 0.17em;
      text-transform: uppercase;
    }
    .note p:not(.eyebrow) { margin: 1.5mm 0 0; color: #A8A099; font-size: 8.6pt; line-height: 1.55; }
    .hooks {
      break-inside: avoid;
      margin-top: 5mm;
      padding: 4.5mm 5mm;
      border: 0.3mm solid rgba(255,255,255,0.10);
      border-radius: 4mm;
      background: rgba(255,255,255,0.02);
    }
    .hook-list { display: flex; flex-wrap: wrap; gap: 2mm; margin-top: 3mm; }
    .hook-list span { padding: 1.6mm 3mm; border: 0.3mm solid rgba(255,255,255,0.10); border-radius: 999px; color: #A8A099; font-size: 8pt; }
    .checklist { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
    .check-card { break-inside: avoid; padding: 4.5mm; border-radius: 4mm; }
    .check-card.do { border: 0.3mm solid rgba(74,222,128,0.28); background: rgba(74,222,128,0.055); }
    .check-card.dont { border: 0.3mm solid rgba(248,113,113,0.28); background: rgba(248,113,113,0.055); }
    .check-label { font-size: 7pt; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }
    .do .check-label { color: #4ADE80; }
    .dont .check-label { color: #F87171; }
    .check-card ul { list-style: none; margin: 3mm 0 0; padding: 0; }
    .check-card li { display: flex; gap: 2mm; margin-bottom: 2.2mm; color: #A8A099; font-size: 8.2pt; line-height: 1.45; }
    .check-card li span { flex: 0 0 auto; font-weight: 700; }
    .do li span { color: #4ADE80; }
    .dont li span { color: #F87171; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 4mm; border: 0.3mm solid rgba(255,255,255,0.10); }
    th { padding: 2.5mm 3.5mm; background: rgba(255,255,255,0.035); border-bottom: 0.3mm solid rgba(255,255,255,0.10); color: #746D66; font-size: 6.8pt; font-weight: 700; letter-spacing: 0.14em; text-align: left; text-transform: uppercase; }
    td { padding: 3mm 3.5mm; border-bottom: 0.3mm solid rgba(255,255,255,0.08); color: #A8A099; font-size: 8.5pt; }
    tr:last-child td { border-bottom: 0; }
    td.strong { color: #F7F4F0; font-weight: 600; }
    .faq { border-top: 0.3mm solid rgba(255,255,255,0.10); }
    .faq-item { break-inside: avoid; padding: 3.6mm 0; border-bottom: 0.3mm solid rgba(255,255,255,0.10); }
    .faq-item h3 { margin: 0; font-size: 9.8pt; letter-spacing: -0.01em; }
    .faq-item p { max-width: 160mm; margin: 1.3mm 0 0; color: #A8A099; font-size: 8.5pt; line-height: 1.55; }
    .doc-foot {
      position: absolute;
      right: 16mm;
      bottom: 10mm;
      left: 16mm;
      display: flex;
      justify-content: space-between;
      padding-top: 3mm;
      border-top: 0.3mm solid rgba(255,255,255,0.08);
      color: #746D66;
      font-size: 6.8pt;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .cover { background: #080706; }
    .cover .page-content { height: 100%; padding: 18mm 17mm 14mm; display: flex; flex-direction: column; }
    .cover-glow {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(52% 42% at 82% 4%, rgba(255,159,10,0.30), transparent 68%),
        radial-gradient(44% 34% at 4% 90%, rgba(240,25,27,0.16), transparent 72%);
    }
    .cover-grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px);
      background-size: 22mm 22mm;
      mask-image: radial-gradient(70% 62% at 50% 0%, #000 0%, transparent 78%);
      -webkit-mask-image: radial-gradient(70% 62% at 50% 0%, #000 0%, transparent 78%);
    }
    .cover-content { position: relative; z-index: 1; display: flex; flex: 1; flex-direction: column; }
    .cover-brand { display: flex; align-items: center; gap: 4mm; }
    .cover-brand img { width: 16mm; height: 16mm; border-radius: 3.5mm; }
    .cover-brand div { display: flex; flex-direction: column; }
    .cover-brand strong { font-size: 12pt; letter-spacing: 0.12em; }
    .cover-brand span { color: #746D66; font-size: 7pt; letter-spacing: 0.22em; text-transform: uppercase; }
    .cover-kicker { margin-top: 30mm; color: #FF9F0A; font-size: 8pt; font-weight: 700; letter-spacing: 0.24em; text-transform: uppercase; }
    .cover h1 {
      max-width: 150mm;
      margin: 6mm 0 0;
      font-size: 54pt;
      line-height: 0.91;
      letter-spacing: -0.055em;
    }
    .cover h1 span { color: #FF9F0A; }
    .cover-sub { max-width: 128mm; margin: 7mm 0 0; color: #A8A099; font-size: 12pt; line-height: 1.65; }
    .cover-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-top: auto; padding-top: 16mm; }
    .stat { padding: 5mm; border: 0.3mm solid rgba(255,255,255,0.10); border-radius: 4mm; background: rgba(255,255,255,0.03); }
    .stat strong { display: block; font-size: 24pt; line-height: 1; letter-spacing: -0.04em; }
    .stat span { display: block; max-width: 60mm; margin-top: 2mm; color: #A8A099; font-size: 8pt; line-height: 1.45; }
    .cover-foot { display: flex; justify-content: space-between; margin-top: 12mm; padding-top: 4mm; border-top: 0.3mm solid rgba(255,255,255,0.10); color: #746D66; font-size: 7pt; letter-spacing: 0.14em; text-transform: uppercase; }
    .closing .page-content { height: 100%; display: flex; flex-direction: column; }
    .closing-card {
      margin-top: 16mm;
      padding: 9mm;
      border: 0.3mm solid rgba(255,159,10,0.30);
      border-radius: 6mm;
      background: rgba(255,159,10,0.07);
    }
    .closing h2 { max-width: 145mm; }
    .closing p { max-width: 150mm; color: #A8A099; font-size: 10pt; line-height: 1.7; }
    .closing-links { display: grid; gap: 3mm; margin-top: 7mm; }
    .closing-link { display: flex; justify-content: space-between; padding: 4mm 5mm; border: 0.3mm solid rgba(255,255,255,0.10); border-radius: 3.5mm; color: #F7F4F0; font-size: 9pt; }
    .closing-link span { color: #FF9F0A; }
  </style>
</head>
<body>
  <section class="page cover">
    <div class="cover-glow"></div>
    <div class="cover-grid"></div>
    <div class="page-content cover-content">
      <div class="cover-brand">
        <img src="${iconUri}" alt="Mhomho" />
        <div><strong>MHOMHO</strong><span>Media · Creator network</span></div>
      </div>
      <p class="cover-kicker">The creator playbook · ${escapeHtml(GUIDE_EDITION)}</p>
      <h1>Make the crowd<br /><span>notice you.</span></h1>
      <p class="cover-sub">Campaign Zero, better clips, verified views and getting paid on Mhomho. Built for Africa's distribution network.</p>
      <div class="cover-stats">${coverStats}</div>
      <div class="cover-foot"><span>mhomho.work/creator-guide</span><span>Free guide</span></div>
    </div>
  </section>
  ${sectionPages}
  <section class="page inner closing">
    <div class="page-glow"></div>
    <div class="page-content">
      <div class="doc-head"><span class="doc-brand">Mhomho creator guide</span><span class="doc-section">${escapeHtml(GUIDE_EDITION)}</span></div>
      <p class="section-kicker" style="margin-top: 18mm;">Take it with you</p>
      <h2>The guide is free.<br />The first clip is yours.</h2>
      <p style="margin-top: 5mm; color: #A8A099; font-size: 10.5pt; line-height: 1.7;">Start with Campaign Zero. Post one clip featuring Mhomho. Reach 500 verified views. Then unlock paid campaigns and get paid to post content.</p>
      <div class="closing-card">
        <p class="eyebrow" style="margin: 0; color: #FF9F0A; font-size: 7pt; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;">Start here</p>
        <div class="closing-links">
          <div class="closing-link"><span>Read the guide online</span><span>mhomho.work/creator-guide</span></div>
          <div class="closing-link"><span>Create a creator account</span><span>mhomho.work</span></div>
          <div class="closing-link"><span>Talk to a human</span><span>${escapeHtml(GUIDE_SUPPORT_EMAIL)}</span></div>
        </div>
      </div>
      <p style="margin-top: auto; padding-top: 14mm; color: #746D66; font-size: 7.5pt; line-height: 1.6;">Base rate is $1.00 per 1,000 verified views. Campaign CPMs and qualifying thresholds can differ; the brief always wins. Payouts are manual and sent directly. The app does not process withdrawals.</p>
      <div class="cover-foot"><span>Built in Harare, for Africa.</span><span>${escapeHtml(GUIDE_EDITION)}</span></div>
    </div>
  </section>
</body>
</html>`;

mkdirSync(outputDir, { recursive: true });
const tempDir = path.join(tmpdir(), 'mhomho-creator-guide');
mkdirSync(tempDir, { recursive: true });
const htmlPath = path.join(tempDir, 'creator-guide.html');
writeFileSync(htmlPath, html, 'utf8');

const userDataDir = path.join(tempDir, 'chrome-profile');
mkdirSync(userDataDir, { recursive: true });

const args = [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--no-pdf-header-footer',
  '--print-to-pdf-no-header',
  '--run-all-compositor-stages-before-draw',
  '--virtual-time-budget=12000',
  `--user-data-dir=${userDataDir}`,
  `--print-to-pdf=${outputPdf}`,
  pathToFileURL(htmlPath).href,
];

execFileSync(chrome, args, { stdio: 'inherit' });

if (!existsSync(outputPdf)) {
  throw new Error(`The PDF was not created at ${outputPdf}`);
}

const pdf = readFileSync(outputPdf);
if (pdf.subarray(0, 5).toString('ascii') !== '%PDF-') {
  throw new Error('The generated file is not a valid PDF.');
}

const pageCount = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length;
console.log(`Created ${path.relative(projectRoot, outputPdf)} (${pdf.byteLength} bytes, ${pageCount} pages).`);
