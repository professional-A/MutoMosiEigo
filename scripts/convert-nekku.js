const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

const TARGETS = [
  {
    src: 'nekku/test.html',
    dst: 'nekku/test/data.json',
    title: '熱流体工学Ⅰ 中間試験対策',
    subtitle: '演習全問＋課題全問を参考に作成・数字変更済 ｜ ⚠️ 答えは有効数字3桁で入力',
    storageKey: 'nekku_test',
    subject: '熱流体工学Ⅰ',
    pointsPerPart: 300,
  },
  {
    src: 'nekku/kako.html',
    dst: 'nekku/kako/data.json',
    title: '熱流体工学Ⅰ 前期中間 過去問',
    subtitle: '実際の試験問題 全13問・図付き ｜ ⚠️ 答えは有効数字3桁で入力',
    storageKey: 'nekku_kako',
    subject: '熱流体工学Ⅰ',
    pointsPerPart: 300,
  },
  {
    src: 'nekku/kako-kai.html',
    dst: 'nekku/kako-kai/data.json',
    title: '熱流体工学Ⅰ 前期中間 改変版',
    subtitle: '数値・条件を変えた練習問題 全13問 ｜ ⚠️ 答えは有効数字3桁で入力',
    storageKey: 'nekku_kako_kai',
    subject: '熱流体工学Ⅰ',
    pointsPerPart: 300,
  },
];

function extractProbs(html) {
  // Find the script block containing SVG[] and PROBS
  const scriptTagRe = /<script>/g;
  let match;
  while ((match = scriptTagRe.exec(html)) !== null) {
    const end = html.indexOf('</script>', match.index);
    const block = html.slice(match.index + 8, end);
    if (!block.includes('PROBS')) continue;

    // Replace const/let with var so variables become context properties
    const code = block.replace(/\bconst\b/g, 'var').replace(/\blet\b/g, 'var');
    const ctx = vm.createContext({
      document: { getElementById: () => ({ style: {}, textContent: '', innerHTML: '', className: '' }), querySelectorAll: () => [] },
      window: {},
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    });
    vm.runInContext(code, ctx);
    if (ctx.PROBS) return ctx.PROBS;
  }
  throw new Error('PROBS not found');
}

for (const target of TARGETS) {
  const srcPath = path.join(ROOT, target.src);
  if (!fs.existsSync(srcPath)) { console.log(`SKIP (not found): ${target.src}`); continue; }

  const html = fs.readFileSync(srcPath, 'utf8');
  if (html.length < 300 && html.includes('location.replace')) {
    console.log(`SKIP (already redirect): ${target.src}`);
    continue;
  }

  let probs;
  try { probs = extractProbs(html); }
  catch (e) { console.error(`ERROR ${target.src}: ${e.message}`); continue; }

  const cleanProbs = probs.map(p => {
    const obj = { no: p.no, ch: p.ch, chN: p.chN, tag: p.tag, q: p.q };
    if (p.svg) obj.svg = p.svg;
    if (p.hint) obj.hint = p.hint;
    if (p.reveal) obj.reveal = p.reveal;
    obj.parts = p.parts.map(pt => {
      const out = { label: pt.label || '', unit: pt.unit, ans: pt.ans, isAngle: !!pt.isAngle };
      if (pt.mult) out.mult = pt.mult;
      return out;
    });
    return obj;
  });

  const data = {
    title: target.title,
    subtitle: target.subtitle,
    storageKey: target.storageKey,
    subject: target.subject,
    pointsPerPart: target.pointsPerPart,
    problems: cleanProbs,
  };

  const dstPath = path.join(ROOT, target.dst);
  fs.mkdirSync(path.dirname(dstPath), { recursive: true });
  fs.writeFileSync(dstPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`OK: ${target.dst} (${cleanProbs.length} problems)`);

  const redirectHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><script>location.replace('/nekku-quiz.html?d=${target.dst}');<\/script></head></html>`;
  fs.writeFileSync(srcPath, redirectHtml, 'utf8');
  console.log(`   redirect → /nekku-quiz.html?d=${target.dst}`);
}

console.log('\nDone.');
