// tests/ を走査してテスト索引を組み立てる（GET /api/tests が使用）。
// data.json を持つ各サブディレクトリ + tests/_legacy.json（旧 index.html 方式）を結合。
// DB・認証・アーカイブ判定には関与しない（applyExamArchive は index.html 側）。
const fs = require('fs');
const path = require('path');

const TESTS_DIR = path.join(__dirname, 'tests');
const LEGACY_FILE = path.join(TESTS_DIR, '_legacy.json');

function countItems(data) {
  if (!Array.isArray(data.sections)) return 0;
  return data.sections.reduce(
    (sum, sec) => sum + (Array.isArray(sec.qs) ? sec.qs.length : 0),
    0
  );
}

function readLegacy() {
  let raw;
  try {
    raw = fs.readFileSync(LEGACY_FILE, 'utf8');
  } catch (e) {
    return []; // 無ければ空（2c で全件 data.json 化したら消える想定）
  }
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.warn('[tests-index] _legacy.json parse error: ' + e.message);
    return [];
  }
}

function buildTestsIndex() {
  const out = [];
  const dirents = fs.readdirSync(TESTS_DIR, { withFileTypes: true });

  for (const dirent of dirents) {
    if (!dirent.isDirectory()) continue;
    const dir = dirent.name;

    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(TESTS_DIR, dir, 'data.json'), 'utf8'));
    } catch (e) {
      // data.json 無し(ENOENT=旧index.html方式) はスキップ。壊れている場合のみ warn。
      if (e.code !== 'ENOENT') {
        console.warn('[tests-index] skip ' + dir + ': ' + e.message);
      }
      continue;
    }

    for (const k of ['year', 'grade', 'exam', 'subject', 'title']) {
      const v = data[k];
      if (v === undefined || v === null || v === '') {
        console.warn('[tests-index] ' + dir + '/data.json: "' + k + '" が欠けています');
      }
    }

    out.push({
      year: data.year,
      grade: data.grade,
      exam: data.exam,
      subject: data.subject,
      title: data.title,
      storageKey: data.storageKey != null ? data.storageKey : null,
      totalItems: countItems(data),
      type: data.type, // undefined は JSON 化で自動的に落ちる
      path: '/quiz.html?d=tests/' + dir + '/data.json',
    });
  }

  return out.concat(readLegacy());
}

module.exports = { buildTestsIndex, countItems };
