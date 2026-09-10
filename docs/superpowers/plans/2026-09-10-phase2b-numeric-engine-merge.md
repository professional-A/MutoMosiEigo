# フェーズ2(2b)：`numeric` 問題タイプ追加とエンジン統合 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `js/quiz-engine.js` に数値解答タイプ `numeric` を追加し、熱流体3ファイルを `sections` スキーマへ移行、`js/nekku-engine.js` と `quiz.html` の出し分けを廃止する。

**Architecture:** `quiz-engine.js` の `buildQuestion` に `else if (q.type === 'numeric')` を1本足し、`window.numCheck/numHint/numReveal` を追加。CSS は既存の `CSS` テンプレート文字列に `.num-*` を追記。既存4タイプ（`single|multi|sort|input`）は不変更。熱流体3 `data.json` は `{problems:[…]}` → `{sections:[{qs:[{type:"numeric",…}]}]}`（1ファイル1セクション・順序保持）。

**Tech Stack:** バニラ JS、KaTeX（`data.katex` 時のみロード）、`node`（標準 fs）。テスト/リントツールなし。

**参照スペック:** `docs/superpowers/specs/2026-09-10-phase2b-numeric-engine-merge-design.md`

---

## 前提・環境メモ

- `npm start` は DB env 必須。**ロジック検証は `node --check` と `node -e`、UI 検証は静的サーバー（`python3 -m http.server 8000` → `http://localhost:8000/quiz.html?d=…`）で行う。**
- 変更/追加: `js/quiz-engine.js`（変更）・`tests/2026-4-zenki-chukan-nekku{,-kako,-kako-kai}/data.json`（変更）・`quiz.html`（変更）・`tests-index.js`（変更）・`.claude/skills/{test-creation-workflow,project-architecture}.md`（変更）、削除 `js/nekku-engine.js`。
- タスク順序: **1 → 2 → 3 → 4 → 5**。各コミット時点で全テストが壊れないようにこの順（2 完了で熱流体は既に quiz-engine 経由で動く。3 は死んだ分岐の除去）。

## File Structure

| ファイル | 役割 |
|---|---|
| `js/quiz-engine.js`（変更） | `CSS` に `.num-*` 追記／`buildQuestion` に `numeric` 分岐／`window.numCheck`・`numHint`・`numReveal`／先頭コメントの type 一覧に `numeric`／共有 `.fb` ブロックを `numeric` では出さない |
| `tests/2026-4-zenki-chukan-nekku/data.json` 他2件（変更） | `problems` → `sections`。`type:"numeric"` 化、`katex:true` 付与 |
| `quiz.html`（変更） | `data.problems` の出し分けを削除、常に `quiz-engine.js` + `initQuiz` |
| `tests-index.js`（変更） | `countItems` の `data.problems` 分岐を削除（2a で入れた保険。移行後は不要） |
| `js/nekku-engine.js`（削除） | 役割終了 |
| `.claude/skills/test-creation-workflow.md`（変更） | 問題タイプ表に `numeric` 行 |
| `.claude/skills/project-architecture.md`（変更） | 存在しない `nekku_*.html` の行を削除 |

---

## Task 1: `js/quiz-engine.js` に `numeric` タイプを追加

**Files:**
- Modify: `js/quiz-engine.js`

### Step 1: 先頭コメントの type 一覧を更新

old（6行目）:
```js
// question types: single | multi | sort | input
```
new:
```js
// question types: single | multi | sort | input | numeric
```

### Step 2: `CSS` テンプレートに `.num-*` を追記

`js/quiz-engine.js` の `CSS` 文字列末尾、次の行の**直後**に追記する。

anchor（76行目付近）:
```css
@media(max-width:560px){.q-top{flex-direction:column;gap:7px}}
```
その行の直後（閉じバッククォート `` ` `` の直前）に挿入:
```css
.num-tag{display:inline-block;font-family:"JetBrains Mono",monospace;font-size:.72rem;color:var(--teal);background:rgba(70,214,196,.1);border:1px solid var(--line);border-radius:6px;padding:2px 8px;margin-bottom:8px}
.num-svg{margin:10px 0;overflow-x:auto}
.num-svg svg{max-width:100%;height:auto;display:block}
.num-part{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px}
.num-label{font-size:.9rem;color:var(--muted);min-width:1.5em}
.num-input{font-family:inherit;font-size:.98rem;color:var(--ink);background:var(--bg2);border:1px solid var(--line);border-radius:10px;padding:9px 12px;width:150px;outline:none;transition:.2s}
.num-input:focus{border-color:var(--teal-d)}
.num-input.ok{border-color:var(--good);background:rgba(95,224,168,.08)}
.num-input.ng{border-color:var(--bad);background:rgba(240,107,142,.07)}
.num-unit{font-size:.85rem;color:var(--muted);white-space:nowrap}
.num-fb{font-size:.85rem;font-weight:600}
.num-fb.g{color:var(--good)}
.num-fb.b{color:var(--bad)}
.num-actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.num-hint{background:var(--bg2);border-left:3px solid var(--amber);border-radius:0 8px 8px 0;padding:9px 13px;margin-top:10px;font-size:.86rem;color:var(--muted);white-space:pre-line;line-height:1.8}
.num-reveal{background:rgba(95,224,168,.06);border-left:3px solid var(--good);border-radius:0 8px 8px 0;padding:9px 13px;margin-top:8px;font-size:.86rem;color:#cdfbe5;line-height:1.85}
```

### Step 3: `buildQuestion` に `numeric` 分岐と `.fb` ガードを入れる

`buildQuestion` 内、`input` 分岐の閉じ `}`（235行目付近、`  }` のみの行）の**直後**、`const fbShow = ...`（237行目付近）の**直前**に挿入する。

old:
```js
    if (q.hint && _state[key] === undefined) {
      inner += `<div class="note" style="margin-top:6px">💡 ヒント: ${q.hint}</div>`;
    }
  }

  const fbShow = _state[key] !== undefined ? 'show' : '';
  const ok = _state[key] === 1;
  inner += `<div class="fb ${fbShow}"><span class="verdict ${ok ? 'g' : 'b'}">${ok ? '✓ 正解' : '✗ 不正解'}</span>${q.note ? `<div class="note">${q.note}</div>` : ''}</div>`;
  inner += `</div></div>`;
```
new:
```js
    if (q.hint && _state[key] === undefined) {
      inner += `<div class="note" style="margin-top:6px">💡 ヒント: ${q.hint}</div>`;
    }

  } else if (q.type === 'numeric') {
    const parts = Array.isArray(q.parts) ? q.parts : [];
    if (q.tag) inner += `<div class="num-tag">${q.tag}</div>`;
    if (q.svg) inner += `<div class="num-svg">${q.svg}</div>`;
    parts.forEach((pt, pi) => {
      const pk = key + '_p' + pi;
      const st = _state[pk];
      const cls = st === 1 ? 'ok' : st === -1 ? 'ng' : '';
      const dis = st === 1 ? 'disabled' : '';
      inner += `<div class="num-part">
        ${pt.label ? `<span class="num-label">${pt.label}</span>` : ''}
        <input class="num-input ${cls}" id="ni_${pk}" inputmode="decimal" ${dis} placeholder="答え"
          onkeydown="if(event.key==='Enter')numCheck('${key}','${secId}',${pi})">
        ${pt.unit ? `<span class="num-unit">${pt.unit}</span>` : ''}
        ${st === 1 ? '' : `<button class="btn" onclick="numCheck('${key}','${secId}',${pi})">確認</button>`}
        <span class="num-fb ${st === 1 ? 'g' : st === -1 ? 'b' : ''}" id="nf_${pk}">${st === 1 ? '✓ 正解' : st === -1 ? '✗ もう一度' : ''}</span>
      </div>`;
    });
    if (q.hint || q.reveal) {
      inner += `<div class="num-actions">`;
      if (q.hint) inner += `<button class="btn ghost" onclick="numHint('${key}')">💡 ヒント</button>`;
      if (q.reveal) inner += `<button class="btn ghost" onclick="numReveal('${key}','${secId}')">📖 解答を見る</button>`;
      inner += `</div>`;
    }
    if (q.hint) inner += `<div class="num-hint" id="nh_${key}" hidden>${q.hint}</div>`;
    if (q.reveal) {
      const rv = Array.isArray(q.reveal) ? q.reveal : [q.reveal];
      inner += `<div class="num-reveal" id="nr_${key}" ${_state[key + '_revealed'] ? '' : 'hidden'}>${rv.map(s => `<div>${s}</div>`).join('')}</div>`;
    }
  }

  if (q.type !== 'numeric') {
    const fbShow = _state[key] !== undefined ? 'show' : '';
    const ok = _state[key] === 1;
    inner += `<div class="fb ${fbShow}"><span class="verdict ${ok ? 'g' : 'b'}">${ok ? '✓ 正解' : '✗ 不正解'}</span>${q.note ? `<div class="note">${q.note}</div>` : ''}</div>`;
  }
  inner += `</div></div>`;
```

### Step 4: `numCheck` / `numHint` / `numReveal` を追加

`window.revealInput = function ...` の閉じ `};`（332行目付近）の**直後**、`function addScript(...)`（334行目付近）の**直前**に挿入する。

old:
```js
window.revealInput = function (key, secId) {
  const q = getQ(secId, key); if (!q) return;
  _state[key + '_val'] = Array.isArray(q.ans) ? q.ans[0] : q.ans;
  _state[key] = -1;
  save(); refreshQ(key, secId);
};

function addScript(src, onload) {
```
new:
```js
window.revealInput = function (key, secId) {
  const q = getQ(secId, key); if (!q) return;
  _state[key + '_val'] = Array.isArray(q.ans) ? q.ans[0] : q.ans;
  _state[key] = -1;
  save(); refreshQ(key, secId);
};

window.numCheck = function (key, secId, pi) {
  const q = getQ(secId, key); if (!q) return;
  const part = (q.parts || [])[pi]; if (!part) return;
  const pk = key + '_p' + pi;
  if (_state[pk] === 1) return; // 正解済みはロック
  const inp = document.getElementById('ni_' + pk);
  let v = parseFloat((inp || {}).value);
  if (isNaN(v)) { if (inp) inp.classList.add('ng'); return; }
  if (part.mult) v = v * part.mult;
  const ok = part.angle
    ? Math.abs(v - part.ans) <= 2
    : Math.abs(v - part.ans) / Math.abs(part.ans) <= 0.02;
  _state[pk] = ok ? 1 : -1;
  if (ok && window.addPoints) {
    addPoints(_data.pointsPerPart || _data.pointsPerQ || 100, _storageKey, pk, true, _data.subject);
  }
  const parts = q.parts || [];
  const allOk = parts.length > 0 && parts.every((_, i) => _state[key + '_p' + i] === 1);
  const anyNg = parts.some((_, i) => _state[key + '_p' + i] === -1);
  if (allOk) _state[key] = 1;
  else if (anyNg) _state[key] = -1;
  else delete _state[key];
  save(); refreshQ(key, secId);
};

window.numHint = function (key) {
  const el = document.getElementById('nh_' + key);
  if (el) el.hidden = !el.hidden;
};

window.numReveal = function (key, secId) {
  _state[key + '_revealed'] = 1;
  save(); refreshQ(key, secId);
};

function addScript(src, onload) {
```

### Step 5: 構文チェック

Run: `node --check js/quiz-engine.js`
Expected: 出力なし・exit 0

### Step 6: `numCheck` の採点ロジックを単体確認

Run:
```bash
node -e "
// numCheck の判定式だけを抜き出して確認
function judge(v, part) {
  if (part.mult) v = v * part.mult;
  return part.angle ? Math.abs(v - part.ans) <= 2 : Math.abs(v - part.ans) / Math.abs(part.ans) <= 0.02;
}
console.log(judge(8e-7, {ans: 8.0e-7}));           // true  (完全一致)
console.log(judge(7.9e-7, {ans: 8.0e-7}));         // true  (誤差1.25% < 2%)
console.log(judge(7.5e-7, {ans: 8.0e-7}));         // false (誤差6.25%)
console.log(judge(1.0, {ans: 0.001, mult: 0.001}));// true  (1.0*0.001 = 0.001)
console.log(judge(44, {ans: 45, angle: true}));    // true  (|44-45|=1 <= 2)
console.log(judge(42, {ans: 45, angle: true}));    // false (|42-45|=3 > 2)
"
```
Expected: `true / true / false / true / true / false`

### Step 7: Commit

```bash
git add js/quiz-engine.js
git commit -m "feat(quiz-engine): numeric（数値解答＋許容誤差）問題タイプを追加

buildQuestion に numeric 分岐、window.numCheck/numHint/numReveal、.num-* CSS。
既存の single/multi/sort/input は不変更。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016ad3DsBBiHixufjZCNPv8V"
```
Commit message body verbatim including the `Co-Authored-By: Claude Sonnet 5` line (do not substitute another model name).

---

## Task 2: 熱流体3 `data.json` を `sections` スキーマへ変換

**Files:**
- Modify: `tests/2026-4-zenki-chukan-nekku/data.json`
- Modify: `tests/2026-4-zenki-chukan-nekku-kako/data.json`
- Modify: `tests/2026-4-zenki-chukan-nekku-kako-kai/data.json`

### Step 1: 変換スクリプトを作成

`/tmp/p2b-convert.js`:
```js
const fs = require('fs');
const FILES = [
  'tests/2026-4-zenki-chukan-nekku',
  'tests/2026-4-zenki-chukan-nekku-kako',
  'tests/2026-4-zenki-chukan-nekku-kako-kai',
];

for (const dir of FILES) {
  const f = dir + '/data.json';
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!Array.isArray(d.problems)) { console.log('skip (no problems):', dir); continue; }

  const qs = d.problems.map(p => {
    const q = { type: 'numeric' };
    const tag = [p.ch, p.tag].filter(Boolean).join(' · ');
    if (tag) q.tag = tag;
    q.q = p.q;
    if (p.svg) q.svg = p.svg;
    if (p.hint) q.hint = p.hint;
    if (p.reveal) q.reveal = p.reveal;
    q.parts = (Array.isArray(p.parts) ? p.parts : []).map(pt => {
      const o = {};
      if (pt.label) o.label = pt.label;
      if (pt.unit) o.unit = pt.unit;
      o.ans = pt.ans;
      if (pt.mult !== undefined) o.mult = pt.mult;
      if (pt.isAngle) o.angle = true;
      return o;
    });
    return q;
  });

  const out = {};
  for (const k of ['title', 'subtitle', 'eyebrow', 'description', 'subject', 'year', 'grade', 'exam', 'storageKey', 'tip', 'footer']) {
    if (d[k] !== undefined) out[k] = d[k];
  }
  out.katex = true;
  out.pointsPerPart = d.pointsPerPart || 300;
  out.sections = [{ id: 's1', no: '01', title: '演習問題', qs }];

  fs.writeFileSync(f, JSON.stringify(out, null, 2) + '\n');
  console.log('converted:', dir, '->', qs.length, 'questions');
}
```

### Step 2: 実行

Run (from repo root): `node /tmp/p2b-convert.js`
Expected:
```
converted: tests/2026-4-zenki-chukan-nekku -> 23 questions
converted: tests/2026-4-zenki-chukan-nekku-kako -> 13 questions
converted: tests/2026-4-zenki-chukan-nekku-kako-kai -> 13 questions
```

### Step 3: 構造チェック

Run:
```bash
node -e "
for (const dir of ['tests/2026-4-zenki-chukan-nekku','tests/2026-4-zenki-chukan-nekku-kako','tests/2026-4-zenki-chukan-nekku-kako-kai']) {
  const d = JSON.parse(require('fs').readFileSync(dir + '/data.json', 'utf8'));
  const q = d.sections && d.sections[0] && d.sections[0].qs;
  const ok = d.sections && d.sections.length === 1 && Array.isArray(q)
    && q.every(x => x.type === 'numeric' && Array.isArray(x.parts))
    && d.katex === true && d.problems === undefined
    && typeof d.storageKey === 'string' && d.year !== undefined;
  console.log(dir, q ? q.length : 0, ok ? 'OK' : 'BAD');
  if (!ok) process.exit(1);
}
"
```
Expected: 3 lines ending `OK` with counts 23 / 13 / 13.

### Step 4: 旧 `problems` と機械照合

Run:
```bash
node -e "
const fs = require('fs'), { execSync } = require('child_process');
let fail = 0;
for (const dir of ['tests/2026-4-zenki-chukan-nekku','tests/2026-4-zenki-chukan-nekku-kako','tests/2026-4-zenki-chukan-nekku-kako-kai']) {
  const nw = JSON.parse(fs.readFileSync(dir + '/data.json', 'utf8'));
  const od = JSON.parse(execSync('git show HEAD:' + dir + '/data.json').toString());
  const q = nw.sections[0].qs, p = od.problems;
  const eq = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
  let bad = 0;
  if (q.length !== p.length) bad++;
  for (let i = 0; i < p.length; i++) {
    if (!eq(p[i].svg, q[i].svg)) bad++;
    if (!eq(p[i].hint, q[i].hint)) bad++;
    if (!eq(p[i].reveal, q[i].reveal)) bad++;
    if (!eq(p[i].q, q[i].q)) bad++;
    if (p[i].parts.length !== q[i].parts.length) bad++;
    for (let j = 0; j < p[i].parts.length; j++) {
      if (p[i].parts[j].ans !== q[i].parts[j].ans) bad++;
      if (!eq(p[i].parts[j].mult, q[i].parts[j].mult)) bad++;
      if (!!p[i].parts[j].isAngle !== !!q[i].parts[j].angle) bad++;
    }
  }
  console.log(dir, 'mismatches:', bad);
  if (bad) fail = 1;
}
process.exit(fail);
"
```
Expected: 3 lines all `mismatches: 0`, exit 0.

### Step 5: `git diff` を目視

Run: `git diff --stat` → 3ファイル。`git diff tests/2026-4-zenki-chukan-nekku/data.json | head -60` で、`q` の `<br>`、`hint` の `\n`、`reveal` の要素、`svg` の中身が壊れていないこと（`JSON.parse`↔`JSON.stringify` なのでエスケープは保持されるはず）。KaTeX の `$…$` と `\\` が生きていること。

### Step 6: Commit

```bash
/bin/rm -f /tmp/p2b-convert.js
git add tests/
git commit -m "refactor(tests): 熱流体3件を numeric/sections スキーマへ変換

{problems:[…]} → {sections:[{qs:[{type:numeric,…}]}]}。1ファイル1セクション・
問題順保持。ch を tag に畳み込み、katex:true 付与。ans/svg/hint/reveal は不変。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016ad3DsBBiHixufjZCNPv8V"
```
Commit message body verbatim including the `Co-Authored-By: Claude Sonnet 5` line.
(注: `git add tests/` は3つの data.json のみをステージ。他の `tests/` 配下は変更していないはず。)

---

## Task 3: `quiz.html` の出し分け廃止・`tests-index.js` の掃除・`nekku-engine.js` 削除

**Files:**
- Modify: `quiz.html`
- Modify: `tests-index.js`
- Delete: `js/nekku-engine.js`

### Step 1: `quiz.html` の `.then(data => {...})` を単純化

old:
```js
    .then(data => {
      const src = data.problems ? '/js/nekku-engine.js' : '/js/quiz-engine.js';
      const fn  = data.problems ? 'initNekku' : 'initQuiz';
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => window[fn](data);
      document.head.appendChild(s);
    })
```
new:
```js
    .then(data => {
      const s = document.createElement('script');
      s.src = '/js/quiz-engine.js';
      s.onload = () => window.initQuiz(data);
      document.head.appendChild(s);
    })
```

### Step 2: `tests-index.js` の `countItems` から `problems` 分岐を削除

old:
```js
function countItems(data) {
  if (Array.isArray(data.sections)) {
    return data.sections.reduce(
      (sum, sec) => sum + (Array.isArray(sec.qs) ? sec.qs.length : 0),
      0
    );
  }
  // nekku 系（js/nekku-engine.js）は sections ではなく problems スキーマ。
  // 旧 tests.json の totalItems は problem 数だったのでそれに合わせる。
  if (Array.isArray(data.problems)) return data.problems.length;
  return 0;
}
```
new:
```js
function countItems(data) {
  if (!Array.isArray(data.sections)) return 0;
  return data.sections.reduce(
    (sum, sec) => sum + (Array.isArray(sec.qs) ? sec.qs.length : 0),
    0
  );
}
```

### Step 3: `js/nekku-engine.js` を削除

```bash
git rm js/nekku-engine.js
```

### Step 4: 参照が残っていないか確認

Run:
```bash
grep -rn "nekku-engine\|initNekku\|data\.problems\|\.problems ?" quiz.html tests-index.js index.html js/ ; echo "exit: $?"
```
Expected: マッチ0（`grep` の exit 1）。`js/` にも `quiz.html` にも `nekku-engine` / `initNekku` / `data.problems` が無い。
Run: `test ! -e js/nekku-engine.js && echo removed`
Run: `node --check tests-index.js && node -e "const a=require('./tests-index').buildTestsIndex(); const n=a.filter(t=>t.subject==='熱流体工学Ⅰ'); console.log(n.map(t=>t.storageKey+':'+t.totalItems).join(' '))"`
Expected: `nekku_test:23 nekku_kako:13 nekku_kako_kai:13`（`_legacy.json` 由来の summary は削除済みなので出ない）

### Step 5: Commit

```bash
git add quiz.html tests-index.js
git commit -m "refactor: quiz.html の nekku 出し分けを廃止し nekku-engine.js を削除

quiz.html は常に quiz-engine.js + initQuiz。tests-index.js の countItems から
不要になった problems 分岐を除去。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016ad3DsBBiHixufjZCNPv8V"
```
(`git rm js/nekku-engine.js` は既にステージ済み。`git add quiz.html tests-index.js` と合わせて1コミット。)
Commit message body verbatim including the `Co-Authored-By: Claude Sonnet 5` line.

---

## Task 4: ドキュメント更新

**Files:**
- Modify: `.claude/skills/test-creation-workflow.md`
- Modify: `.claude/skills/project-architecture.md`

### Step 1: `test-creation-workflow.md` の問題タイプ表に `numeric` を追加

`## 問題タイプ` の表（`| type | 必須フィールド | 説明 |` で始まる）の最終行 `| input | ... |` の直後に1行追加:

```
| `numeric` | `parts[]`（各 `ans` 必須） | 数値解答＋許容誤差（相対2%／`angle` は±2）。`parts[].label?`/`unit?`/`mult?`/`angle?`、問題ごとに `tag?`/`svg?`/`hint?`/`reveal?(string[])` |
```

### Step 2: `project-architecture.md` の存在しないファイル行を削除

`## 主要ファイル` の表から次の3行を削除:
```
| `nekku_test.html` | 熱流体工学Ⅰ 中間試験対策テスト（23問） |
| `nekku_kako.html` | 熱流体 前期中間 過去問（13問） |
| `nekku_kako_kai.html` | 熱流体 前期中間 改変版 |
```

（`js/points.js` の行など他は不変更。もし表に `nekku-engine.js` への言及があれば併せて削除。）

### Step 3: Commit

```bash
git add .claude/skills/test-creation-workflow.md .claude/skills/project-architecture.md
git commit -m "docs: numeric タイプを追記し、存在しない nekku_*.html 記述を削除

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016ad3DsBBiHixufjZCNPv8V"
```
Commit message body verbatim including the `Co-Authored-By: Claude Sonnet 5` line.

---

## Task 5: 統合確認

**Files:** なし（確認のみ）

### Step 1: 静的サーバーで numeric テストを開く

```bash
python3 -m http.server 8000 >/dev/null 2>&1 & echo $! > /tmp/p2b-srv.pid ; sleep 1
```
ブラウザで `http://localhost:8000/quiz.html?d=tests/2026-4-zenki-chukan-nekku/data.json`（DevTools Console を開いておく）:

- ナビー系テーマで表示。**Console にエラーが無い**（`initQuiz` が呼ばれ `data.sections` を描画）。
- H1・サブタイトル（「⚠️ 答えは有効数字3桁で入力」）・TOC（`01 演習問題`）・スコアバー・右下「← トップへ」。
- KaTeX で数式がレンダリングされる。SVG（シリンダ図など）が表示される。
- 各問に `tag`（例「第1章 · 動粘度」）。数値入力欄＋「確認」ボタン＋単位。
- Q1 に `8e-7` と入力 →「確認」→「✓ 正解」、入力欄が緑、スコアが 1 に。`7.5e-7` なら「✗ もう一度」。
- 「💡 ヒント」でヒント展開、「📖 解答を見る」で reveal 展開。
- 複数パート問題（Q2 以降に4パートあり）で各パート個別に採点。全パート正解で問題カードが緑枠（`.q.correct`）。
- リロード → 正解済みパートが「✓」で復元、reveal 展開状態も復元。

### Step 2: 他タイプのテストが従来どおり

`http://localhost:8000/quiz.html?d=tests/2026-9-ai-yougo/data.json`（`single`）を開く → 従来どおり選択式が動く。Console エラーなし。
`http://localhost:8000/`（ホーム）→ 熱流体3件のカードが「23問 / 13問 / 13問」の進捗表示、クリックで numeric テストが開く。

確認後: `kill $(cat /tmp/p2b-srv.pid)`

### Step 3: 報告

`npm start`（DB env）が使えない場合は Step 1・2 の静的サーバー確認結果を報告。Render デプロイ後の本番確認（numeric テストの採点・KaTeX・SVG、ホームのカード）を残タスクとして明記。

---

## Self-Review

**1. Spec coverage:**

| スペック項目 | タスク |
|---|---|
| `numeric` データ仕様（`tag/svg/hint/reveal/parts[label,unit,ans,mult,angle]`） | Task 1 Step 3（描画）+ Step 4（採点） ✅ |
| 描画: `.num-*` DOM、既存 `.q`/`.qn`/`.prompt` 流用 | Task 1 Step 2（CSS）+ Step 3 ✅ |
| 採点: `parseFloat`→`mult`→`angle`(±2)/相対2%、`_state[pk]`、`_state[key]` は全パート正解で1 | Task 1 Step 4 `numCheck` ✅ |
| 得点: パート単位 `pointsPerPart||pointsPerQ||100`、dedup キー `${key}_p${idx}` | Task 1 Step 4 ✅ |
| スコア計上は問題レベル（既存 `computeScore`/`updateScore`/`refreshQ` 不変） | 変更なし＝仕様どおり ✅ |
| `numHint`（トグル）/`numReveal`（永続・`_state[key+'_revealed']`） | Task 1 Step 4 ✅ |
| 共有 `.fb` を numeric では出さない | Task 1 Step 3 の `if (q.type !== 'numeric')` ガード ✅ |
| データ変換（`problems`→`sections`、`ch`→`tag`、`isAngle`→`angle`、`katex:true`、1セクション、順序保持） | Task 2 スクリプト ✅ |
| `quiz.html` 出し分け廃止 | Task 3 Step 1 ✅ |
| `js/nekku-engine.js` 削除 | Task 3 Step 3 ✅ |
| `tests-index.js` の `problems` 分岐削除 | Task 3 Step 2 ✅ |
| ドキュメント（`numeric` 追記・`nekku_*.html` 削除） | Task 4 ✅ |
| 検証1-8 | Task 1 Step 5-6・Task 2 Step 3-5・Task 3 Step 4・Task 5 ✅ |
| 「やらない」（2d／紫デザイン移植／progress 移行シム／既存4タイプ変更） | どのタスクでも触れていない ✅ |

**2. Placeholder scan:** 「もし表に…があれば併せて削除」（Task 4 Step 2）は条件付き指示で許容。他に TODO/TBD なし。全ステップにコード／コマンドあり。

**3. Type / 名前の一貫性:**
- パートキー `${key}_p${pi}`（= `ni_`/`nf_` の id、`_state` のキー、`addPoints` の dedup キー）— Task 1 Step 3 と Step 4 で一致。
- `_state[key + '_revealed']` — Step 3（描画時の `hidden` 判定）と Step 4（`numReveal` の書き込み）で一致。
- `numCheck(key, secId, pi)` / `numHint(key)` / `numReveal(key, secId)` — 描画の `onclick` と `window.*` 定義でシグネチャ一致。
- `q.parts[].angle`（新）↔ 変換スクリプトの `if (pt.isAngle) o.angle = true` — 一致。`q.parts[].mult` は名前維持。
- `data.pointsPerPart` — 変換スクリプトが出力（`out.pointsPerPart`）、`numCheck` が読む — 一致。
- `data.katex` — 変換スクリプトが `true` を出力、`initQuiz`（既存）が読む — 一致。
- `countItems` は Task 3 後 `sections` のみ参照。移行後の熱流体は `sections` を持つので 23/13/13 を返す（2a の期待値と同じ）。

## Execution Handoff

実行方式は本計画を渡す時に選択する（subagent-driven 推奨 / inline execution）。
