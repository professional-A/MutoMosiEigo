const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const moves = [
  ['nekku.html',          'nekku/formula.html'],
  ['nekku_test.html',     'nekku/test.html'],
  ['nekku_kako.html',     'nekku/kako.html'],
  ['nekku_kako_kai.html', 'nekku/kako-kai.html'],
];

for (const [src, dst] of moves) {
  let content = fs.readFileSync(path.join(ROOT, src), 'utf8');

  // ./js/ → ../js/ (points.js / progress.js)
  content = content.replace(/src="\.\/js\//g, 'src="../js/');

  // ← トップへ の href 修正（ルート直下→ nekku/ 配下になる）
  content = content.replace(/href="\/"/g, 'href="/"');

  fs.writeFileSync(path.join(ROOT, dst), content, 'utf8');

  // 旧パスにリダイレクト stub
  const redirectHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><script>location.replace('/${dst}');</script></head></html>`;
  fs.writeFileSync(path.join(ROOT, src), redirectHtml, 'utf8');

  console.log(`${src} → ${dst}`);
}
console.log('Done.');
