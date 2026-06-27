// node scripts/convert-quiz-html.js
// 既存テストHTMLを data.json + リダイレクト index.html に一括変換する

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

const TARGETS = [
  'tests/2026-4-zenki-chukan-kakougaku-setugou',
  'tests/2026-4-zenki-chukan-kakougaku-setugou-oyo',
  'tests/2026-4-zenki-chukan-kakougaku-chuzou',
  'tests/2026-4-zenki-chukan-kakougaku-chuzou-oyo',
  'tests/2026-4-zenki-chukan-kakougaku-kakunin',
  'tests/2026-4-zenki-chukan-kakougaku-sosei',
  'tests/2026-4-zenki-chukan-kakougaku-sosei-oyo',
  'tests/2026-4-zenki-chukan-kakougaku-chukan',
  'tests/2026-4-zenki-chukan-seigyogaku',
  'tests/2026-4-zenki-chukan-seigyogaku-block-laplace',
  'tests/2026-4-zenki-chukan-seigyogaku-kakomon2025',
  'tests/2026-4-zenki-chukan-seigyogaku-kakomon2025-ruiji',
  'tests/2026-4-zenki-chukan-seigyogaku-vocab',
  'tests/2026-4-zenki-chukan-seigyogaku-summary',
];

function extractMeta(html) {
  const get = (re, g = 1) => { const m = html.match(re); return m ? m[g].trim() : ''; };

  const storageKey = get(/const STORAGE_KEY\s*=\s*["']([^"']+)["']/);
  const subject    = get(/window\.QUIZ_SUBJECT\s*=\s*['"]([^'"]+)['"]/);
  const eyebrow    = get(/<div class="eyebrow">([^<]+)<\/div>/);
  const katex      = html.includes('katex');

  // <h1>タイトル<br><span ...>サブタイトル</span></h1>
  const h1Full = get(/<h1>([\s\S]+?)<\/h1>/);
  const spanM  = h1Full.match(/<span[^>]*>([\s\S]+?)<\/span>/);
  const subtitle = spanM ? spanM[1] : '';
  const title    = h1Full.replace(/<br\s*\/?>/gi, '').replace(/<span[\s\S]*?<\/span>/gi, '').replace(/<[^>]+>/g, '').trim();

  const description = get(/<p class="sub">([^<]+)<\/p>/);

  // 使い方テキスト（<b>使い方：</b>の後）
  const tipM = html.match(/<div class="tip"[^>]*>\s*<b>使い方：<\/b>([\s\S]+?)<\/div>/);
  const tip  = tipM ? tipM[1].trim() : '';

  const footer    = get(/<footer>([^<]+)<\/footer>/);
  const ptMatch   = html.match(/addPoints\((\d+)/);
  const pointsPerQ = ptMatch ? parseInt(ptMatch[1]) : 100;

  return { storageKey, subject, eyebrow, title, subtitle, description, tip, footer, katex, pointsPerQ };
}

function extractSections(html) {
  const startMarker = 'const SECTIONS = [';
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) return null;

  // Bracket counting with string-skipping to find array end
  let depth = 0, i = startIdx + startMarker.length - 1;
  const start = i;
  let inStr = false, strChar = '', escaped = false;

  while (i < html.length) {
    const c = html[i];
    if (escaped) { escaped = false; i++; continue; }
    if (c === '\\' && inStr) { escaped = true; i++; continue; }
    if (inStr) {
      if (c === strChar) inStr = false;
    } else if (c === '"' || c === "'") {
      inStr = true; strChar = c;
    } else if (c === '[' || c === '{') {
      depth++;
    } else if (c === ']' || c === '}') {
      depth--;
      if (depth === 0) { i++; break; }
    }
    i++;
  }

  const src = html.slice(start, i);
  try {
    const ctx = vm.createContext({});
    vm.runInContext(`var __r = ${src};`, ctx);
    // kakomon2025 系は qs の代わりに data を使う場合がある
    const result = ctx.__r;
    result.forEach(sec => {
      if (!sec.qs && sec.data) {
        sec.qs = sec.data.map(q => ({ type: 'single', ...q }));
        delete sec.data;
        delete sec.desc; // セクション説明はスキップ
      }
    });
    return result;
  } catch (e) {
    console.error('  SECTIONS parse error:', e.message);
    return null;
  }
}

let ok = 0, skip = 0;

for (const rel of TARGETS) {
  const htmlPath = path.join(ROOT, rel, 'index.html');
  if (!fs.existsSync(htmlPath)) {
    console.log(`⚠  skip (no index.html): ${rel}`);
    skip++;
    continue;
  }

  const html = fs.readFileSync(htmlPath, 'utf8');

  // すでにリダイレクト済みならスキップ
  if (html.includes('location.replace')) {
    console.log(`⏭  already converted: ${rel}`);
    skip++;
    continue;
  }

  const meta = extractMeta(html);
  const sections = extractSections(html);

  if (!sections) {
    console.log(`✗  skip (parse failed): ${rel}`);
    skip++;
    continue;
  }

  const totalQ = sections.reduce((n, s) => n + (s.qs ? s.qs.length : 0), 0);

  const data = {
    title:       meta.title       || rel.split('/').pop(),
    ...(meta.subtitle   ? { subtitle:    meta.subtitle }   : {}),
    eyebrow:     meta.eyebrow     || '',
    description: meta.description || '',
    subject:     meta.subject     || '',
    storageKey:  meta.storageKey  || rel.split('/').pop(),
    pointsPerQ:  meta.pointsPerQ,
    katex:       meta.katex,
    ...(meta.tip    ? { tip:    meta.tip }    : {}),
    ...(meta.footer ? { footer: meta.footer } : {}),
    sections,
  };

  // data.json
  const jsonPath = path.join(ROOT, rel, 'data.json');
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');

  // redirect index.html
  const relUnix = rel.replace(/\\/g, '/');
  fs.writeFileSync(htmlPath,
    `<!DOCTYPE html><html><head><meta charset="UTF-8"><script>location.replace('/quiz.html?d=${relUnix}/data.json');</script></head></html>`,
    'utf8'
  );

  console.log(`✓  ${rel}  (${sections.length} sections, ${totalQ} questions)`);
  ok++;
}

console.log(`\n完了: ${ok} 件変換, ${skip} 件スキップ`);
