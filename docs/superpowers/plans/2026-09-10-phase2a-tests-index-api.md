# フェーズ2(2a)：`/api/tests` テスト索引の自動生成 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `tests/` を走査してテスト索引を組み立てる `GET /api/tests` を追加し、手編集の `tests.json` を廃止する。

**Architecture:** 索引組み立てロジックを純関数モジュール `tests-index.js`（リポジトリ直下、`server.js` と同じ場所）に切り出す。`server.js` は3行のルートを1本足すだけ。`data.json` を持つ各サブディレクトリ＋`tests/_legacy.json`（旧 `index.html` 方式7件）を結合して返す。DB・認証・アーカイブ判定には触らない（`applyExamArchive` は `index.html` 側のまま）。

**Tech Stack:** Node.js + Express（`express.static('.')`）、`fs`/`path`（標準）、バニラ JS。テスト/リントツールなし。

**参照スペック:** `docs/superpowers/specs/2026-09-10-phase2-tests-index-api-design.md`

---

## 前提・環境メモ

- `npm start` は DB 環境変数が無いと起動しない。**本計画の主要な検証は `node -e` で `tests-index.js` を直接呼んで行う**（サーバー不要・DB不要）。ブラウザ／Render 確認は最後に回す。
- 変更/追加ファイル: 新規 `tests-index.js` / `tests/_legacy.json`、変更 `server.js`・`index.html`・`tests/*/data.json`（21）・`.claude/skills/test-creation-workflow.md`・`CLAUDE.md`、削除 `tests.json`。
- タスク順序に依存関係あり: **1 → 2 → 3 → 4 → 5**（3 の検証は 1・2 完了が前提、4 は 3 が前提）。

## File Structure

| ファイル | 責務 |
|---|---|
| `tests-index.js`（新規・リポジトリ直下） | `buildTestsIndex()`: `tests/` を同期走査し、`data.json` 由来エントリ＋`tests/_legacy.json` を結合した配列を返す純関数。`countItems()` ヘルパを併せて export。fs 以外の副作用なし |
| `tests/_legacy.json`（新規） | 旧 `index.html` 方式7件（eigo, step1〜4, handout, saishiken）の配列。削除前 `tests.json` の該当エントリをそのままコピー |
| `server.js`（変更） | 冒頭に `require('./tests-index')`。`app.use(express.static('.'))` の直前に `GET /api/tests` を1本追加 |
| `tests/*/data.json`（変更・21） | トップレベルに `year` / `grade` / `exam` を追記 |
| `index.html`（変更） | `fetch('tests.json')` 3か所 → `/api/tests`。エラーメッセージ文言を微修正 |
| `tests.json`（削除） | `/api/tests` が完全代替 |
| `.claude/skills/test-creation-workflow.md`, `CLAUDE.md`（変更） | `year`/`grade`/`exam` 必須をドキュメント化 |

---

## Task 1: `tests/_legacy.json` を作成

**Files:**
- Create: `tests/_legacy.json`

- [ ] **Step 1: ファイル作成**

`tests/_legacy.json`（削除前 `tests.json` の旧 `index.html` 方式7件をそのままコピーしたもの）:

```json
[
  {
    "year": 2026,
    "grade": 4,
    "exam": "前期中間試験",
    "subject": "科学技術英語Ⅰ",
    "path": "tests/2026-4-zenki-chukan-eigo/",
    "storageKey": "mutou_u12",
    "totalItems": 121
  },
  {
    "year": 2026,
    "grade": 4,
    "exam": "再試験",
    "subject": "科学技術英語Ⅰ",
    "title": "科学技術英語Ⅰ ・ 単語 (Step 1)",
    "path": "tests/2026-4-zenki-chukan-step1/",
    "storageKey": "vocab_known_u12",
    "totalItems": 60
  },
  {
    "year": 2026,
    "grade": 4,
    "exam": "再試験",
    "subject": "科学技術英語Ⅰ",
    "title": "科学技術英語Ⅰ ・ 熟語 (Step 2)",
    "path": "tests/2026-4-zenki-chukan-step2/",
    "storageKey": "idiom_known_u12",
    "totalItems": 26
  },
  {
    "year": 2026,
    "grade": 4,
    "exam": "前期中間試験",
    "subject": "科学技術英語Ⅰ",
    "title": "科学技術英語Ⅰ ・ 文法 (Step 3)",
    "path": "tests/2026-4-zenki-chukan-step3/",
    "storageKey": "gram3_known",
    "totalItems": 31
  },
  {
    "year": 2026,
    "grade": 4,
    "exam": "前期中間試験",
    "subject": "科学技術英語Ⅰ",
    "title": "科学技術英語Ⅰ ・ ハンドアウト演習",
    "path": "tests/2026-4-zenki-chukan-handout/",
    "storageKey": "mutou_handout_u12",
    "totalItems": 19
  },
  {
    "year": 2026,
    "grade": 4,
    "exam": "再試験",
    "subject": "科学技術英語Ⅰ",
    "title": "科学技術英語Ⅰ ・ 軽い総合演習（再試験対策）",
    "path": "tests/2026-4-zenki-chukan-saishiken/",
    "storageKey": "mutou_saishiken",
    "totalItems": 29
  },
  {
    "year": 2026,
    "grade": 4,
    "exam": "前期中間試験",
    "subject": "科学技術英語Ⅰ",
    "title": "科学技術英語Ⅰ ・ 本文理解 (Step 4)",
    "path": "tests/2026-4-zenki-chukan-step4/",
    "storageKey": "mutou_step4",
    "totalItems": 45
  }
]
```

- [ ] **Step 2: JSON として妥当か確認**

Run: `node -e "const a=require('./tests/_legacy.json'); if(!Array.isArray(a)||a.length!==7)process.exit(1); console.log('legacy entries:', a.length)"`
Expected: `legacy entries: 7`

- [ ] **Step 3: Commit**

```bash
git add tests/_legacy.json
git commit -m "feat(tests): 旧index.html方式7件を tests/_legacy.json に集約

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016ad3DsBBiHixufjZCNPv8V"
```

---

## Task 2: 既存 `data.json` 21ファイルに `year` / `grade` / `exam` を追記

**Files:**
- Modify: 下記21個の `tests/*/data.json`

- [ ] **Step 1: 移行スクリプトを作成して実行**

`/tmp/p2-add-fields.js` を作成:

```js
const fs = require('fs');
const REPO = process.cwd(); // リポジトリ直下で実行すること

const MAP = {
  'tests/2026-4-zenki-chukan-kakougaku-kakunin':        { year: 2026, grade: 4, exam: '前期中間試験' },
  'tests/2026-4-zenki-chukan-kakougaku-chuzou':         { year: 2026, grade: 4, exam: '前期中間試験' },
  'tests/2026-4-zenki-chukan-kakougaku-chuzou-oyo':     { year: 2026, grade: 4, exam: '前期中間試験' },
  'tests/2026-4-zenki-chukan-kakougaku-sosei':          { year: 2026, grade: 4, exam: '前期中間試験' },
  'tests/2026-4-zenki-chukan-kakougaku-sosei-oyo':      { year: 2026, grade: 4, exam: '前期中間試験' },
  'tests/2026-4-zenki-chukan-kakougaku-setugou':        { year: 2026, grade: 4, exam: '前期中間試験' },
  'tests/2026-4-zenki-chukan-kakougaku-setugou-oyo':    { year: 2026, grade: 4, exam: '前期中間試験' },
  'tests/2026-4-zenki-chukan-nekku':                    { year: 2026, grade: 4, exam: '前期中間試験' },
  'tests/2026-4-zenki-chukan-nekku-kako':               { year: 2026, grade: 4, exam: '前期中間試験' },
  'tests/2026-4-zenki-chukan-nekku-kako-kai':           { year: 2026, grade: 4, exam: '前期中間試験' },
  'tests/2026-4-zenki-chukan-seigyogaku':               { year: 2026, grade: 4, exam: '前期中間試験' },
  'tests/2026-4-zenki-chukan-seigyogaku-vocab':         { year: 2026, grade: 4, exam: '前期中間試験' },
  'tests/2026-4-zenki-chukan-seigyogaku-block-laplace': { year: 2026, grade: 4, exam: '前期中間試験' },
  'tests/2026-4-zenki-chukan-seigyogaku-kakomon2025':       { year: 2025, grade: 4, exam: '前期中間試験' },
  'tests/2026-4-zenki-chukan-seigyogaku-kakomon2025-ruiji': { year: 2025, grade: 4, exam: '前期中間試験' },
  'tests/2026-9-denki-tangen-form':  { year: 2026, grade: 4, exam: '単元テスト' },
  'tests/2026-9-denki-tangen-slide': { year: 2026, grade: 4, exam: '単元テスト' },
  'tests/2026-9-ai-yougo':   { year: 2026, grade: 4, exam: '前期末試験' },
  'tests/2026-9-ai-ichimon': { year: 2026, grade: 4, exam: '前期末試験' },
  'tests/2026-9-ai-kakomon': { year: 2026, grade: 4, exam: '前期末試験' },
  'tests/2026-9-ai-ruiji':   { year: 2026, grade: 4, exam: '前期末試験' },
};

let updated = 0, skipped = 0, missing = 0;
for (const [dir, m] of Object.entries(MAP)) {
  const f = REPO + '/' + dir + '/data.json';
  let s;
  try { s = fs.readFileSync(f, 'utf8'); }
  catch (e) { console.log('MISSING:', f); missing++; continue; }
  if (/"year"\s*:/.test(s)) { console.log('skip (has year):', dir); skipped++; continue; }
  const ins = `  "year": ${m.year},\n  "grade": ${m.grade},\n  "exam": "${m.exam}",\n`;
  const s2 = s.replace(/^(\s*)"subject"\s*:/m, ins + '$1"subject":');
  if (s2 === s) { console.log('NO "subject" LINE:', dir); missing++; continue; }
  fs.writeFileSync(f, s2);
  console.log('updated:', dir);
  updated++;
}
console.log(`\nupdated=${updated} skipped=${skipped} missing=${missing}`);
if (missing > 0 || updated + skipped !== 21) process.exit(1);
```

Run (from repo root):
```bash
node /tmp/p2-add-fields.js
```
Expected: `updated: ...` が21行、末尾 `updated=21 skipped=0 missing=0`、終了コード 0。
`missing` が出たらそのディレクトリ名を報告して **STOP**（BLOCKED）。

- [ ] **Step 2: 追記結果を確認**

Run:
```bash
node -e "
const fs=require('fs');
const dirs=fs.readdirSync('tests',{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name);
let bad=0, withData=0;
for(const d of dirs){
  let x; try{ x=JSON.parse(fs.readFileSync('tests/'+d+'/data.json','utf8')); }catch(e){ continue; }
  withData++;
  if(x.year===undefined||x.grade===undefined||!x.exam){ console.log('MISSING fields:', d); bad++; }
}
console.log('data.json dirs:', withData, ' missing-fields:', bad);
if(bad>0||withData!==21) process.exit(1);
"
```
Expected: `data.json dirs: 21  missing-fields: 0`, 終了コード 0.

- [ ] **Step 3: git diff がフィールド追記のみか確認**

Run: `git diff --stat` → 21ファイル、`+63` 行前後、削除は0。
Run: `git diff tests/2026-9-ai-yougo/data.json | head -20` → `"year": 2026,` / `"grade": 4,` / `"exam": "前期末試験",` の3行が `"subject":` の直前に入っているだけ。

- [ ] **Step 4: Commit**

```bash
rm /tmp/p2-add-fields.js
git add tests/
git commit -m "feat(tests): 全 data.json に year/grade/exam を追記（/api/tests 用）

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016ad3DsBBiHixufjZCNPv8V"
```

---

## Task 3: `tests-index.js` と `GET /api/tests` を追加

**Files:**
- Create: `tests-index.js`（リポジトリ直下）
- Modify: `server.js`（冒頭の require 群、`app.use(express.static('.'))` の直前）

- [ ] **Step 1: `tests-index.js` を作成**

```js
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
```

- [ ] **Step 2: `server.js` に require を追加**

`server.js` の冒頭、`const crypto = require('crypto');` の直後に1行追加する。

old:
```js
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
```

new:
```js
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { buildTestsIndex } = require('./tests-index');
```

- [ ] **Step 3: `server.js` に `/api/tests` ルートを追加**

`app.use(express.static('.'));` の**直前**に挿入する。

old:
```js
app.use(express.static('.'));
```

new:
```js
app.get('/api/tests', (req, res) => {
  try {
    res.json(buildTestsIndex());
  } catch (e) {
    console.error('[api/tests] ' + ((e && e.stack) || e));
    res.status(500).json({ error: String(e) });
  }
});

app.use(express.static('.'));
```

- [ ] **Step 4: 構文チェック**

Run: `node --check tests-index.js && node --check server.js`
Expected: 出力なし、終了コード 0

- [ ] **Step 5: 索引が正しく組み上がるか確認（サーバー不要）**

Run:
```bash
node -e "
const a = require('./tests-index').buildTestsIndex();
console.log('total:', a.length);
const noYear = a.filter(t => t.year === undefined);
console.log('missing year:', noYear.length);
const kakoPaths = a.filter(t => t.subject === '加工学').map(t => t.path);
console.log('kakougaku paths OK:', kakoPaths.every(p => p.startsWith('/quiz.html?d=tests/')), kakoPaths.length);
console.log('summary types:', a.filter(t => t.type === 'summary').length);
"
```
Expected:
- `total: 28`
- `missing year: 0`（`[tests-index] ... が欠けています` の warn も出ないこと）
- `kakougaku paths OK: true 7`
- `summary types: 0`（死んだ summary 2件は消えた。`_legacy.json` にも summary なし）

- [ ] **Step 6: 旧 `tests.json` と storageKey 集合を照合**

Run:
```bash
node -e "
const a = require('./tests-index').buildTestsIndex();
const now = a.map(t => t.storageKey).filter(Boolean).sort();
const { execSync } = require('child_process');
const old = JSON.parse(execSync('git show HEAD:tests.json').toString())
  .map(t => t.storageKey).filter(Boolean)
  .filter(k => k !== 'kakougaku_chukan_v1') // 死んだエントリの唯一の storageKey
  .sort();
const a1 = JSON.stringify(now), o1 = JSON.stringify(old);
console.log('match:', a1 === o1);
if (a1 !== o1) { console.log('NOW:', a1); console.log('OLD:', o1); }
"
```
Expected: `match: true`

- [ ] **Step 7: 壊れた data.json を1件だけ落とすことを確認**

```bash
cp tests/2026-9-ai-yougo/data.json /tmp/p2-yougo-bak.json
echo '{ broken' > tests/2026-9-ai-yougo/data.json
node -e "const a=require('./tests-index').buildTestsIndex(); console.log('total:', a.length, ' has yougo:', a.some(t=>t.storageKey==='ai_yougo_v1'))" 2>&1
cp /tmp/p2-yougo-bak.json tests/2026-9-ai-yougo/data.json && rm /tmp/p2-yougo-bak.json
```
Expected: `[tests-index] skip 2026-9-ai-yougo: ...` の warn が出て、`total: 27  has yougo: false`。復元後は Step 5 が再び 28 に戻る（`git status` がクリーンであることも確認）。

- [ ] **Step 8: Commit**

```bash
git add tests-index.js server.js
git commit -m "feat(api): GET /api/tests でテスト索引を tests/ から自動生成

tests/*/data.json を走査し tests/_legacy.json を結合して返す。tests.json
手編集を不要にする。壊れた data.json は該当ディレクトリのみスキップ。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016ad3DsBBiHixufjZCNPv8V"
```

---

## Task 4: `index.html` のフェッチ先を切り替え、`tests.json` を削除

**Files:**
- Modify: `index.html`（`tests.json` を参照する4か所）
- Delete: `tests.json`

- [ ] **Step 1: `fetch('tests.json')`（シングルクォート・2か所）を置換**

`index.html` 内の次の文字列は **2回** 出現する（行1417付近・1463付近、完全に同一）。両方を置換する（Edit の `replace_all` 相当）。

old（×2）:
```js
    const data = await fetch('tests.json').then(r => r.json());
```
new（×2）:
```js
    const data = await fetch('/api/tests').then(r => r.json());
```

- [ ] **Step 2: `fetch("tests.json")`（ダブルクォート・1か所）を置換**

old（行1680付近）:
```js
fetch("tests.json")
```
new:
```js
fetch("/api/tests")
```

- [ ] **Step 3: エラーメッセージの文言を更新**

old（行1688付近）:
```js
      `<div class="empty">模試データを読み込めませんでした。<br>tests.json が存在するか確認してください。</div>`;
```
new:
```js
      `<div class="empty">模試データを読み込めませんでした。<br>/api/tests の応答を確認してください。</div>`;
```

（行1423付近のもう1つのエラー文言 `tests.json の読み込みに失敗しました` も `/api/tests の読み込みに失敗しました` に変えてよい。任意・軽微。）

- [ ] **Step 4: `tests.json` を削除**

```bash
git rm tests.json
```

- [ ] **Step 5: 参照が残っていないか確認**

Run: `grep -n "tests\.json" index.html`
Expected: `fetch` 由来の一致は 0。残ってよいのはコメント（行1414付近 `// tests.json を直接フェッチ…` — 文言を `// /api/tests をフェッチ…` に直すのが望ましいが必須ではない）や、行3784付近の別コメントのみ。`grep -c "fetch('/api/tests')\\|fetch(\"/api/tests\")" index.html` → `3`。

Run: `test ! -e tests.json && echo "tests.json removed"`

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "refactor(index): テスト一覧を /api/tests から取得し tests.json を削除

fetch 先を3か所差し替え。renderGroups/applyExamArchive 等のロジックは不変更。
死んだ3エントリ（加工学 中間試験風/制御 まとめノート/熱流体 公式集）はここで消える。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016ad3DsBBiHixufjZCNPv8V"
```

---

## Task 5: ドキュメント更新

**Files:**
- Modify: `.claude/skills/test-creation-workflow.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: `test-creation-workflow.md` のスキーマに3フィールドを追加**

`## data.json スキーマ` の JSON ブロックで、`"title": "テストタイトル",` の直前（またはブロック先頭）に追加:

```json
  "year": 2026,
  "grade": 4,
  "exam": "前期末試験",
```

同ファイルの「## 新しいテストを作るとき」の手順3
```
3. `index.html` にリンクを追加する場合は `/quiz.html?d=tests/YYYY-M-テスト名/data.json`
```
を次に置換:
```
3. リンクの追記は不要。`GET /api/tests` が `tests/*/data.json` を走査して自動で拾う（`year`/`grade`/`exam`/`subject`/`storageKey` 必須）
```
また「`index.html` は**作成しない**。URLは `/quiz.html?d=...` を直接使う。」の直後に1文追加:
```
`tests.json` は廃止済み（`/api/tests` が代替）。手編集するファイルは無い。
```

- [ ] **Step 2: `CLAUDE.md` に追記**

`## アーキテクチャ改善（進行中 / 2026-09-10〜）` のリスト項目 `2.` の行末、または `## 科目の扱い（重要）` の末尾に1行:

```
- 新しいテストの `data.json` には `year`（数値）・`grade`（数値）・`exam`（文字列）が必須。`GET /api/tests` がこれを使って索引を自動生成する（`tests.json` は廃止済み・手編集ファイルなし）。
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/test-creation-workflow.md CLAUDE.md
git commit -m "docs: data.json の year/grade/exam 必須と tests.json 廃止を記載

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016ad3DsBBiHixufjZCNPv8V"
```

---

## Task 6: 統合確認（サーバー起動が可能な場合）

**Files:** なし（確認のみ）

- [ ] **Step 1: DB env がある環境で `npm start`**

`DATABASE_URL` / `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` がある場合のみ。無ければこのタスクは「Render デプロイ後に実施」と報告して DONE_WITH_CONCERNS。

```bash
npm start &   # 別ターミナル可
sleep 3
curl -s localhost:3000/api/tests | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(s);console.log('len',a.length);console.log('kakougaku paths', a.filter(t=>t.subject==='加工学').map(t=>t.path));})"
```
Expected: `len 28`、加工学の path が全て `/quiz.html?d=...`。

- [ ] **Step 2: ブラウザ `http://localhost:3000/`**

- カード一覧・科目グループ・年度学年見出し（`2025年度` の過去問2件を含む）・進捗バーが従来と一致
- 死んだ3エントリ（加工学 中間試験風／制御 まとめノート／熱流体 公式集）が**消えている**
- 加工学・制御工学のカードをクリック → `/quiz.html?d=…` でテストが開く（従来リンク切れだった箇所が直っている）
- 管理モーダル →「日程管理」で subject×exam ペアが従来どおり列挙される。アーカイブのトグルが効く

- [ ] **Step 3: `tests/` に data.json だけのダミーを追加**

```bash
mkdir -p tests/9999-9-dummy
cat > tests/9999-9-dummy/data.json <<'EOF'
{ "year": 9999, "grade": 4, "exam": "ダミー試験", "subject": "ダミー", "title": "ダミー ・ テスト", "storageKey": "dummy_v1", "sections": [ { "id": "s1", "no": "01", "title": "s", "qs": [ { "type": "single", "q": "?", "opts": ["a","b"], "ans": "a" } ] } ] }
EOF
```
サーバー再起動 → `curl -s localhost:3000/api/tests | grep -c dummy_v1` → `1`（`tests.json` 未編集で出現）。確認後 `rm -rf tests/9999-9-dummy`。

- [ ] **Step 4: 報告**

DB 環境が無くここまで実施できない場合は、その旨と「Task 3 の `node -e` 検証は全てパス済み」を報告して締める。Render デプロイ後の本番確認（`/api/tests` が 28件、`/` の表示、加工学リンク復活）を残タスクとして明記。

---

## Self-Review

**1. Spec coverage:**

| スペック項目 | タスク |
|---|---|
| `GET /api/tests`（`express.static` の前・走査・`data.json`→エントリ・`path` 生成・`totalItems` 算出・skip・500） | Task 3（`tests-index.js` + route） ✅ |
| `tests/_legacy.json`（旧7件） | Task 1 ✅ |
| `data.json` 21件に `year`/`grade`/`exam` 追記（2025年度の過去問2件に注意） | Task 2（MAP に反映） ✅ |
| `index.html` の `fetch` 3か所差し替え | Task 4 Step 1-3 ✅ |
| `tests.json` 削除 | Task 4 Step 4 ✅ |
| `test-creation-workflow.md` / `CLAUDE.md` 追記 | Task 5 ✅ |
| エラー処理（parse不能skip / フィールド欠落warn / `_legacy.json`欠落→空 / `tests/`読めない→500 / 認証なし） | Task 3 の `tests-index.js` と route ✅ |
| 検証1-8 | Task 3 Step 5-7・Task 4 Step 5・Task 6 ✅ |
| 「やらない」（2b/2c/2d・`renderGroups`等ロジック・アーカイブのサーバー移動・`exam_schedule`） | どのタスクでも触れていない ✅ |

**スペックとの相違（意図的）:** スペックは「`server.js` に `GET /api/tests` を追加」＋「`totalItems` 算出はヘルパ関数に切り出す」と記載。本計画では索引組み立て全体を純関数モジュール `tests-index.js` に切り出し、`server.js` 側は3行のルートのみとした。理由: (a) DB/サーバー無しで `node -e` から直接呼べて検証が確実になる、(b) 1700行の `server.js` に走査ロジックを混ぜない。スペックの意図（`/api/tests` が `tests/` を走査して索引を返す）と挙動は同一。

**2. Placeholder scan:** 「任意・軽微」と明記した箇所以外に TODO/TBD なし。全ステップにコード or 実行可能コマンドあり。

**3. Type / 名前の一貫性:**
- `buildTestsIndex()` / `countItems()` — Task 3 の定義、Task 3 Step 5-7 と Task 6 の呼び出しで一致。
- エントリのキー `{year,grade,exam,subject,title,storageKey,totalItems,type?,path}` — `tests-index.js` の生成、`_legacy.json` の構造、`index.html` の `renderGroups`（`t.year`/`t.grade`/`t.exam`/`t.subject`/`t.title`/`t.storageKey`/`t.totalItems`/`t.path`/`t.type`）で一致。
- `require('./tests-index')` の相対パス — `server.js` はリポジトリ直下なので `./tests-index` で解決。`node -e` もリポジトリ直下で実行する前提を各ステップに明記。
- MAP のキー21個 = File Structure の「21」= Task 2 Step 2 の期待値 `withData!==21` チェックと一致。

## Execution Handoff

実行方式は本計画を渡す時に選択する（subagent-driven 推奨 / inline execution）。
