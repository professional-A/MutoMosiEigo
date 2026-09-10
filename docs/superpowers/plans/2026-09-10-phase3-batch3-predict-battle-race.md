# フェーズ3 バッチ3 — 予測 / バトル / レース を独立ページ化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `index.html` のモーダルになっている「英語テスト点数予測イベント」「バトル」「レース」を、それぞれ独立した `predict.html` / `battle.html` / `race.html` に切り出し、直リンク可能にする。

**Architecture:** バッチ2と同じマルチページ方式。各ページは `supabase(CDN)` → `/styles/theme.css` → `/js/api.js` → `/js/nav.js` → `/js/app-shell.js` → `/js/util.js` を読み、`appShell.mount(bar, { nav: window.APP_NAV, onNotif: ()=>location.href='/' })` で共通ヘッダー＋認証を得る。`authToken`/`authUser`/`authUserId`/`authEmail`/`authPoints`/`authLifetimePoints` を `appshell:auth` イベント（`appShell.user` / `appShell.token`）から橋渡しし `onAuthReady()` を呼ぶ。ページ本体は `index.html` から該当 markup / 関数 / 状態変数を**バイト一致で移植**する。

**Tech Stack:** Vanilla JS（ES2020）、Express 静的配信、Supabase JS v2（CDN）。テスト・リントなし → 検証は「`node --check`」＋「静的サーバ + `curl`」＋「関数バイト一致照合（`node -e`）」＋「実ブラウザ手動チェックリスト（Task 5）」。

**前提（バッチ2で完了済み）:** `js/util.js`（`window.esc`/`tu`/`titleBadge`/`showPointToast`）、`styles/theme.css` に `.ranking-table`/`.rank-*`/`.avatar`/`.frame-*`/`.shogou`/`.clrank-*` を集約済み、`js/nav.js`（`window.APP_NAV` は既に `/predict.html` `/battle.html` `/race.html` を指す）。

## 方針メモ（重要）

- **バッチ3も「追加のみ」。** `index.html` からの markup / 関数 / CSS の削除は **フェーズ3 バッチ6**。バッチ3で `index.html` は一切変更しない（バッチ2 Task 7 のような helper 統合も無し。`_fmtMin` 等はレース専用で共有化しない）。
- **`styles/theme.css` への追記は既存 `index.html <style>` と同一ルールの重複**（同一なので表示不変）。
- **実ポイント連動あり:** `predict`（予測・賭け金は即時ポイント減算）、`battle`（賭け＝シーズンpt）。**ブラウザ検証必須。テストは自分のアカウントで。**
- **スコープ確定事項:**
  - `race.html` には「自分のペア名インライン編集」＝ `editPairName` / `savePairName` のみ含める。**ペア設定モーダル（`openPairModal` / `closePairModal` / `pairAddGroup` / `savePairs`）と「レース発行モーダル」（`openRaceModal` 他）は `index.html` に残し、フェーズ3 バッチ5（`admin.html`）で扱う。** 根拠：`openPairModal` は冒頭で `closeAdminModal()` を呼ぶ管理者導線。
  - `predict.html` の `updateAuthBar()` 呼び出しは `appShell.refreshAuth()`（`/api/me` 再取得）に置換。ヘッダーの所持pt をポイント変動後に更新する挙動を保つ。
  - `race.html` の `loadRaceSection` は `index.html` で `#race-view-bg` の表示状態を見て描画するが、独立ページでは常に描画する（下記 Task 4 で該当行を変更）。

---

## File Structure

| ファイル | 役割 | 変更種別 |
|---|---|---|
| `styles/theme.css` | 末尾に追記：`.battle-*`（index.html:286-295）、`.race-*` / `#race-section` / `#race-pair-ranking`（index.html:242-269） | 追記のみ |
| `predict.html` | 英語テスト点数予測イベント。3フェーズ状態機械（予測／得点入力／完了）＋ワースト順位表＋配分結果。実ポイント。 | 新規 |
| `battle.html` | バトル一覧＋派閥選択＋ベット。実ポイント（シーズンpt）。 | 新規 |
| `race.html` | レース：個人ランキング＋ペアランキング＋勉強時間自己申告＋自ペア名編集。 | 新規 |
| `index.html` | **変更なし**（markup・nav・CSS はバッチ6まで温存） | — |

## 共通スキャフォールド（Task 2-4 で参照）

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>__TITLE__ ・ 武藤模試</title>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<link rel="stylesheet" href="/styles/theme.css">
<style>
  body{margin:0;background:var(--bg);color:var(--ink);font-family:'Fraunces',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  #app-shell-bar{position:fixed;top:0;left:0;right:0;z-index:100}
  main{max-width:720px;margin:0 auto;padding:72px 16px 40px}
  main h1{font-size:1.15rem;margin:8px 0 14px}
  __PAGE_CSS__
</style>
</head>
<body>
<div id="app-shell-bar"></div>
<main>
__MAIN__
</main>
<script src="/js/api.js"></script>
<script src="/js/nav.js"></script>
<script src="/js/app-shell.js"></script>
<script src="/js/util.js"></script>
<script>
let authToken = null, authUser = null, authUserId = null, authEmail = null, authPoints = 0, authLifetimePoints = 0;
function _syncAuthGlobals() {
  const u = window.appShell && window.appShell.user;
  authToken           = (window.appShell && window.appShell.token) || null;
  authUser            = u ? u.username : null;
  authUserId          = u ? u.id : null;
  authEmail           = u ? (u.email || '') : null;
  authPoints          = u ? (u.points || 0) : 0;
  authLifetimePoints  = u ? (u.lifetimePoints || 0) : 0;
}
function updateAuthBar() { if (window.appShell) window.appShell.refreshAuth(); }
window.addEventListener('appshell:auth', () => { _syncAuthGlobals(); onAuthReady(); });

appShell.mount(document.getElementById('app-shell-bar'), {
  nav: window.APP_NAV,
  onNotif: () => { location.href = '/'; }
});

__PAGE_JS__
</script>
</body>
</html>
```

**注意:** `updateAuthBar()` は `appShell.refreshAuth()` を呼ぶだけの薄いシム。`refreshAuth()` は `/api/me` を再取得して `appshell:auth` を再発火するので、`_syncAuthGlobals()` → `onAuthReady()` が再度走り `authPoints` 等が最新化される。`predict.html` の移植コードは `authPoints = data.points` の直後に `updateAuthBar()` を呼ぶ（＝サーバ値で二重に確定するが冪等）。

---

## Task 1: `styles/theme.css` — battle / race のコンポーネント CSS を追記

**Files:**
- Modify: `styles/theme.css`（末尾に追記）
- 参照元: `index.html:242-269`（race）、`index.html:286-295`（battle）

- [ ] **Step 1: 対象ブロックを確認**

Run: `sed -n '241,270p;286,296p' index.html`
Expected: `#race-section` / `.race-hd` / `.race-table` / `.race-rival` / `.race-report` / `.race-group-row` / `#race-pair-ranking ...` と `.battle-card` / `.battle-vs` / `.battle-player` / `.battle-vs-label` / `.battle-row` / `.battle-badge*` が表示される。**間に `@media` ブロックが挟まる**ので範囲をそのまま写すこと（`sed -n '256,258p'` に `.race-table` の media クエリ、`#race-pair-ranking .race-table th:nth-child(3)` などがある）。`.battle-*` の直後（296行）は `.clrank-block-conf` なので **286-295 だけ**写す。

- [ ] **Step 2: `styles/theme.css` 末尾に追記**

```css

/* --- レース（index.html:242-269） --- */
<index.html:242-269 を VERBATIM。#race-section / .race-hd / .race-hd-title / .race-hd-date /
 .race-body / .race-groups / .race-group-chip / .race-group-chip span / .race-table /
 .race-table th / .race-table td / .race-table tr:last-child td / .race-table .rank-me /
 @media(...) { .race-table ... / .race-table th,td ... / #race-pair-ranking .race-table th:nth-child(3),... } /
 .race-rival / .race-rival.ahead / .race-report / .race-report input / .race-report button /
 .race-group-row / .race-group-row input など、その範囲にある全ルール> 

/* --- バトル（index.html:286-295） --- */
<index.html:286-295 を VERBATIM。.battle-card / .battle-vs / .battle-player / .battle-player-name /
 .battle-player-bet / .battle-vs-label / .battle-row / .battle-badge / .battle-badge-open / .battle-badge-settled>
```
プロパティ値は 1 文字も変えない。`sed` で見えた行をそのまま貼る。

- [ ] **Step 3: 検証 — 追記されたか**

```bash
node -e "
const fs=require('fs');
const css=fs.readFileSync('styles/theme.css','utf8');
const need=['#race-section','.race-hd','.race-table','.race-table .rank-me','.race-rival','.race-rival.ahead','.race-report','.race-group-row','#race-pair-ranking',
 '.battle-card','.battle-vs','.battle-player','.battle-vs-label','.battle-row','.battle-badge','.battle-badge-open','.battle-badge-settled'];
let bad=0; for(const s of need){ if(!css.includes(s)){ console.log('MISSING',s); bad++; } }
console.log(bad? bad+' MISSING' : 'ALL PRESENT ('+need.length+')');
const o=(css.match(/{/g)||[]).length, c=(css.match(/}/g)||[]).length;
console.log('braces', o, c, o===c?'BALANCED':'UNBALANCED');
"
```
Expected: `ALL PRESENT (18)` と `BALANCED`

- [ ] **Step 4: 検証 — 各行が index.html とバイト一致**

```bash
node -e "
const fs=require('fs');
const idx=fs.readFileSync('index.html','utf8').split('\n');
const css=fs.readFileSync('styles/theme.css','utf8');
let bad=0;
for(const [a,b] of [[242,269],[286,295]]) for(let i=a;i<=b;i++){ const l=idx[i-1]; if(l.trim()==='')continue; if(!css.includes(l)){ console.log('index.html:'+i+' 未一致:',JSON.stringify(l)); bad++; } }
console.log(bad? bad+' 行未一致' : 'すべて一致');
"
```
Expected: `すべて一致`

- [ ] **Step 5: index.html 未変更を確認**

Run: `/usr/bin/git status --porcelain`
Expected: `M styles/theme.css` のみ

- [ ] **Step 6: コミット**

```bash
/usr/bin/git add styles/theme.css
/usr/bin/git commit -m "$(cat <<'EOF'
refactor(3-3): battle/race のコンポーネントCSSを theme.css に追記

index.html <style>:242-269/286-295 と同一。撤去はバッチ6。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KM28JJxt3JocdSahvonhec
EOF
)"
```

---

## Task 2: `predict.html` — 英語テスト点数予測イベント

**Files:**
- Create: `predict.html`
- 参照元: `index.html:598-698`（`#test-modal-bg` の中身）、`index.html:1812-2000`（`PRED_DEADLINE` 〜 `submitScoreEdit`）

- [ ] **Step 0: 実ソース確認**

Run: `sed -n '598,698p' index.html` と `sed -n '1812,2000p' index.html`
確認する関数：`openTestModal`（→ `refreshPredictPage` に改名・モーダル開閉行を除去）、`loadTestState`、`showTestPhase`、`loadTestResults`、`loadTestPayouts`、`submitPrediction`、`submitPredictionChange`、`submitScore`、`submitScoreEdit`。`const PRED_DEADLINE = new Date('2026-06-16T00:00:00Z');`。

- [ ] **Step 1: `predict.html` をスキャフォールドから作成**

`__TITLE__` = `点数予測イベント`

`__PAGE_CSS__`:
```css
  #test-msg{margin:8px 0;font-size:.85rem;min-height:1.2em}
  .modal input{background:var(--card2);color:var(--ink);border:1px solid var(--line);border-radius:8px;font-family:inherit}
```

`__MAIN__` = `index.html:599-697` の `<div class="modal" ...>` の**中身**（`<h2>📋 英語テスト…</h2>` から フェーズ1/2/3 の各 `<div id="test-phase-*">`、`#test-msg`、`#test-results-wrap`、`#test-payouts-wrap` まで）を移植。ただし：
  - 先頭の「✕」ボタン（`onclick="closeTestModal()"`）と末尾の `<div class="modal-btns">…閉じる…</div>` は**削除**（独立ページに閉じるボタン不要）。
  - `<h2>` を `<h1>` に。
  - それ以外の id・inline style・`onclick`（`submitPrediction()` 等）は 1 文字も変えない。

`__PAGE_JS__`:
```js
const PRED_DEADLINE = new Date('2026-06-16T00:00:00Z'); // JST 9:00 AM

// index.html:openTestModal を改名、lockScroll()/classList.add('open')/textContent='' の初期化のうち
// モーダル関連2行を除去。#test-msg クリアは残す。
async function refreshPredictPage() {
  document.getElementById('test-msg').textContent = '';
  await loadTestState();
}

// ↓ index.html:1829-2000 の loadTestState / showTestPhase / loadTestResults /
//   loadTestPayouts / submitPrediction / submitPredictionChange / submitScore / submitScoreEdit
//   を VERBATIM コピー（1文字も変えない。updateAuthBar() 呼び出しはスキャフォールドのシムが処理）
<PASTE index.html:1829-2000 VERBATIM>

function onAuthReady() { refreshPredictPage(); }
```

> **注意:** `showTestPhase` は `authPoints` を参照（`bet-points-display*` に表示）。`onAuthReady` 経由で `_syncAuthGlobals()` 後に走るので値が入る。未ログイン時は `loadTestState` の `fetch('/api/test/me', {headers:{Authorization:null}})` がエラー→ `#test-msg` に「エラー」。これは `index.html` 未ログイン時と同挙動（テストイベントはログイン前提）。`closeTestModal` とモーダル click リスナはコピーしない。

- [ ] **Step 2: 構文チェック**

```bash
node -e "const fs=require('fs');const h=fs.readFileSync('predict.html','utf8');fs.writeFileSync('/tmp/p.js',[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n;\n'));" && node --check /tmp/p.js
```
Expected: 出力なし・exit 0

- [ ] **Step 3: バイト一致照合**

```bash
node -e "
const fs=require('fs');
const idx=fs.readFileSync('index.html','utf8'), pg=fs.readFileSync('predict.html','utf8');
function blk(s,sig){const a=s.indexOf(sig);if(a<0)return null;let i=s.indexOf('{',a),d=0;for(;i<s.length;i++){if(s[i]==='{')d++;else if(s[i]==='}'){d--;if(!d)return s.slice(a,i+1);}}}
for(const sig of ['async function loadTestState()','function showTestPhase(data)','async function loadTestResults()','async function loadTestPayouts()','async function submitPrediction()','async function submitPredictionChange()','async function submitScore()','async function submitScoreEdit()']){
  const b=blk(idx,sig); console.log(sig.padEnd(40), b && pg.includes(b) ? 'IDENTICAL':'DIFFERS');
}
console.log('PRED_DEADLINE同一:', pg.includes(\"new Date('2026-06-16T00:00:00Z')\")?'OK':'BAD');
console.log('closeTestModal未コピー:', !pg.includes('function closeTestModal')?'OK':'BAD');
"
```
Expected: 全 `IDENTICAL` / `OK`

- [ ] **Step 4: 静的サーバ**

```bash
(python3 -m http.server 8131 >/dev/null 2>&1 & echo $! >/tmp/s.pid); sleep 1
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8131/predict.html
curl -s http://localhost:8131/predict.html | grep -c 'id="test-phase-predict"\|id="test-phase-score"\|id="test-phase-done"\|id="pred-input"\|id="test-results-wrap"'
kill $(cat /tmp/s.pid) 2>/dev/null
```
Expected: `200` と `5`

- [ ] **Step 5: index.html 未変更**

Run: `/usr/bin/git status --porcelain`
Expected: `?? predict.html` のみ

- [ ] **Step 6: コミット**

```bash
/usr/bin/git add predict.html
/usr/bin/git commit -m "$(cat <<'EOF'
refactor(3-3): 点数予測イベントを predict.html に独立ページ化

3フェーズ状態機械（予測/得点入力/完了）＋ワースト順位表＋配分結果。実ポイント。
index.html:1812-2000 から移植（openTestModal→refreshPredictPage、updateAuthBar→appShell.refreshAuth）。
index.html のモーダルはバッチ6まで温存。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KM28JJxt3JocdSahvonhec
EOF
)"
```

---

## Task 3: `battle.html` — バトル一覧＋ベット

**Files:**
- Create: `battle.html`
- 参照元: `index.html:889-897`（`#battle-modal-bg` の中身）、`index.html:2393-2540`（`openBattleModal` 〜 `submitBattleBet`）

- [ ] **Step 0: 実ソース確認**

Run: `sed -n '889,898p' index.html` と `sed -n '2393,2542p' index.html`
関数：`openBattleModal`（→ `refreshBattlePage`）、`BATTLE_SUBJ_LABEL`、`loadBattleContent`、`_battleSides`、`selectBattleSide`、`updateSideBtns`、`submitBattleBet`。`closeBattleModal` とモーダル click リスナはコピーしない。

- [ ] **Step 1: `battle.html` をスキャフォールドから作成**

`__TITLE__` = `バトル`

`__PAGE_CSS__`: （なし。`.battle-*` は Task 1 で theme.css に入る）

`__MAIN__`:
```html
  <h1>⚔️ バトル</h1>
  <div id="battle-content">読み込み中…</div>
```
（`index.html:889-897` の `#battle-modal-bg > .modal` は `<h2>` と閉じるボタンだけで本体は `#battle-content`。`#battle-content` の id を保つ。）

`__PAGE_JS__`:
```js
async function refreshBattlePage() {
  await loadBattleContent();
}

// ↓ index.html:2406-2540 の BATTLE_SUBJ_LABEL / loadBattleContent / _battleSides /
//   selectBattleSide / updateSideBtns / submitBattleBet を VERBATIM コピー
<PASTE index.html:2406-2540 VERBATIM>

function onAuthReady() { refreshBattlePage(); }
loadBattleContent();  // 認証解決前でも一覧は出す（未ログインはベットフォーム非表示）
```

> `loadBattleContent` は `authToken`（`/api/battles` ヘッダ）・`authPoints`（所持pt表示）・`authUser` を参照。未ログイン時 `authToken=null` で `/api/battles` はベット情報なしの一覧を返す想定（`index.html` と同挙動）。`submitBattleBet` は成功時 `loadBattleContent()` のみ呼ぶ（ヘッダーpt更新なし＝`index.html` と同挙動）。

- [ ] **Step 2-5: 構文チェック / バイト一致 / 静的サーバ / git**

```bash
node -e "const fs=require('fs');const h=fs.readFileSync('battle.html','utf8');fs.writeFileSync('/tmp/b.js',[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n;\n'));" && node --check /tmp/b.js
```
```bash
node -e "
const fs=require('fs');
const idx=fs.readFileSync('index.html','utf8'), bg=fs.readFileSync('battle.html','utf8');
function blk(s,sig){const a=s.indexOf(sig);if(a<0)return null;let i=s.indexOf('{',a),d=0;for(;i<s.length;i++){if(s[i]==='{')d++;else if(s[i]==='}'){d--;if(!d)return s.slice(a,i+1);}}}
for(const sig of ['async function loadBattleContent()','function selectBattleSide(battleId, side)','function updateSideBtns(battleId, side)','async function submitBattleBet(battleId)']){
  const b=blk(idx,sig); console.log(sig.padEnd(42), b && bg.includes(b)?'IDENTICAL':'DIFFERS');
}
console.log('BATTLE_SUBJ_LABEL同一:', bg.includes(\"eigo: '英語', ouri: '応物'\")?'OK':'BAD');
console.log('closeBattleModal未コピー:', !bg.includes('function closeBattleModal')?'OK':'BAD');
"
```
```bash
(python3 -m http.server 8131 >/dev/null 2>&1 & echo $! >/tmp/s.pid); sleep 1
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8131/battle.html
curl -s http://localhost:8131/battle.html | grep -c 'id="battle-content"'
kill $(cat /tmp/s.pid) 2>/dev/null
```
Expected: 全 `IDENTICAL`/`OK`、`200`、`1`。`/usr/bin/git status --porcelain` → `?? battle.html` のみ。

- [ ] **Step 6: コミット**

```bash
/usr/bin/git add battle.html
/usr/bin/git commit -m "$(cat <<'EOF'
refactor(3-3): バトルを battle.html に独立ページ化

バトル一覧＋派閥選択＋ベット（実ポイント／シーズンpt）。
index.html:2393-2540 から移植（openBattleModal→refreshBattlePage）。
index.html のモーダルはバッチ6まで温存。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KM28JJxt3JocdSahvonhec
EOF
)"
```

---

## Task 4: `race.html` — レース（個人＋ペアランキング＋自己申告）

**Files:**
- Create: `race.html`
- 参照元: `index.html:762-808`（`#race-view-bg` の中身）、`index.html:3436-3726`（`loadRaceSection` 〜 `submitRaceAll`。ただし下記の通り一部除外）

- [ ] **Step 0: 実ソース確認**

Run: `sed -n '762,808p' index.html` と `sed -n '3430,3730p' index.html`
**コピーする関数:** `loadRaceSection`（1行変更、下記）、`_fmtMin`、`_fmtSec`、`_renderRace`、`toggleRaceTool`、`editPairName`、`savePairName`、`toggleRaceBody`、`submitRaceAll`。`_currentRace` 変数。
**コピーしない:** `openRaceView` / `closeRaceView`（ページ自体がビュー）、`openPairModal` / `closePairModal` / `pairAddGroup` / `savePairs`（→ バッチ5 `admin.html`）、`openRaceModal` 以降（→ バッチ5）。

- [ ] **Step 1: `race.html` をスキャフォールドから作成**

`__TITLE__` = `レース`。`__PAGE_CSS__` はなし（`.race-*` は Task 1 で theme.css）。

`__MAIN__` = `index.html:763-807` の `<div class="modal" ...>` の**中身**（`<h2 id="race-hd-title">` から `#race-self-report` まで）。先頭「✕」ボタンは削除。`<h2>` → `<h1>`。id・onclick はそのまま。

`__PAGE_JS__`:
```js
let _currentRace = null;

// index.html:loadRaceSection をコピーし、#race-view-bg の表示チェック行だけ変更：
//   変更前: if (document.getElementById('race-view-bg').style.display !== 'none') _renderRace(data);
//   変更後: _renderRace(data);
async function loadRaceSection() {
  try {
    const data = await fetch('/api/races/current').then(r => r.json());
    if (!data.race) { _currentRace = null; document.getElementById('race-hd-title').textContent = '🏁 開催中のレースはありません'; return; }
    _currentRace = data.race;
    _renderRace(data);
  } catch(e) {}
}

// ↓ index.html:3454-3726 の _fmtMin / _fmtSec / _renderRace / toggleRaceTool /
//   editPairName / savePairName / toggleRaceBody / submitRaceAll を VERBATIM コピー
//   （_renderRace は #race-view-btn を参照しないが、内部で参照する全 DOM id は __MAIN__ に含まれる）
<PASTE index.html:3454-3726 VERBATIM（openPairModal 群は含めない）>

function onAuthReady() { loadRaceSection(); }
loadRaceSection();  // 認証前でも一覧描画（自己申告フォームは inRace && active のときだけ表示）
```

> **注意:** `_renderRace` は `authUserId` を参照（自分ハイライト・自ペア判定）。`onAuthReady` 経由で最新化。`submitRaceAll` は `_currentRace` と `authToken` が必要（未ログイン/レースなしは早期 return）。`_renderRace` 内の `document.getElementById('race-view-btn')` 参照は **無い**（それは `loadRaceSection` 側）。`loadRaceSection` の元コードにある `race-view-btn` の表示制御は独立ページに不要なので上記の書き換え版で落としている。`editPairName` は `#race-pair-ranking` に行を差し込む——その id は `__MAIN__` に含まれる。

- [ ] **Step 2: 構文チェック**

```bash
node -e "const fs=require('fs');const h=fs.readFileSync('race.html','utf8');fs.writeFileSync('/tmp/r.js',[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n;\n'));" && node --check /tmp/r.js
```
Expected: 出力なし・exit 0

- [ ] **Step 3: バイト一致照合 ＋ 除外確認**

```bash
node -e "
const fs=require('fs');
const idx=fs.readFileSync('index.html','utf8'), rg=fs.readFileSync('race.html','utf8');
function blk(s,sig){const a=s.indexOf(sig);if(a<0)return null;let i=s.indexOf('{',a),d=0;for(;i<s.length;i++){if(s[i]==='{')d++;else if(s[i]==='}'){d--;if(!d)return s.slice(a,i+1);}}}
for(const sig of ['function _fmtMin(totalMin)','function _fmtSec(sec)','function _renderRace(data)','function toggleRaceTool()','function editPairName(pairId, currentName)','async function savePairName(pairId)','function toggleRaceBody()','async function submitRaceAll()']){
  const b=blk(idx,sig); console.log(sig.padEnd(40), b && rg.includes(b)?'IDENTICAL':'DIFFERS');
}
for(const n of ['function openPairModal','function savePairs','function pairAddGroup','function openRaceModal','function closeRaceView','function openRaceView']){
  console.log(n+' 未コピー:', !rg.includes(n)?'OK':'BAD');
}
"
```
Expected: 8 `IDENTICAL` ＋ 6 `OK`

- [ ] **Step 4: 静的サーバ**

```bash
(python3 -m http.server 8131 >/dev/null 2>&1 & echo $! >/tmp/s.pid); sleep 1
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8131/race.html
curl -s http://localhost:8131/race.html | grep -c 'id="race-table-body"\|id="race-pair-ranking"\|id="race-self-report"\|id="race-muto-h"'
kill $(cat /tmp/s.pid) 2>/dev/null
```
Expected: `200` と `4`

- [ ] **Step 5: index.html 未変更**

Run: `/usr/bin/git status --porcelain`
Expected: `?? race.html` のみ

- [ ] **Step 6: コミット**

```bash
/usr/bin/git add race.html
/usr/bin/git commit -m "$(cat <<'EOF'
refactor(3-3): レースを race.html に独立ページ化

個人ランキング＋ペアランキング＋勉強時間自己申告＋自ペア名編集。
index.html:3436-3726 から移植（openRaceView/closeRaceView 廃止、loadRaceSection の
#race-view-bg 表示チェックを撤去）。ペア設定・レース発行モーダルは admin.html（バッチ5）。
index.html のモーダルはバッチ6まで温存。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KM28JJxt3JocdSahvonhec
EOF
)"
```

---

## Task 5: 実ブラウザ手動チェックリスト＋メモリ更新

**Files:**
- Modify: `/Users/sho/.claude/projects/-Users-sho-work-MutoMosiEigo/memory/architecture-refactor-2026-09.md`

- [ ] **Step 1: `npm start`（要 `DATABASE_URL`）でサーバ起動**（ユーザーに依頼）

- [ ] **Step 2: `/predict.html`（ログインして自分のアカウントで）**
  - [ ] フェーズ1（予測未入力）：予測点・賭け金を入力 → 送信 → ヘッダーの所持ptが減る（`refreshAuth`）→ フェーズ2表示
  - [ ] フェーズ2：締め切り前なら予測変更フォーム、得点入力 → フェーズ3
  - [ ] フェーズ3：予測/実際/誤差/賭け金カード、締め切り前は修正フォーム
  - [ ] ワースト順位表（`/api/test/results` + `/api/test/pool`）・配分結果（`/api/test/payouts`）が出る
  - [ ] `PRED_DEADLINE` 経過後の分岐（得点入力のみ可）※再現できれば
  - [ ] コンソールエラーなし

- [ ] **Step 3: `/battle.html`**
  - [ ] 未ログイン：一覧＋倍率表示、ベットフォーム非表示
  - [ ] ログイン後：派閥ボタン選択 → 賭け金入力 → 「賭ける」→ トースト → 一覧更新（`/api/battles/:id/bet`）
  - [ ] closed / settled バトルの表示（🔒締め切り済み、🏆勝ち/🤝引き分け、あなた:勝ち/負け）
  - [ ] `.battle-card` / `.battle-vs` のレイアウトが従来通り
  - [ ] コンソールエラーなし

- [ ] **Step 4: `/race.html`**
  - [ ] 開催中レースなし → 「開催中のレースはありません」
  - [ ] 個人ランキング（合計時間降順・同順位・ライバル差・👑）、自分の行ハイライト
  - [ ] ペアランキング（人数補正 ×maxN/size バッジ）、自ペアなら ✏️ でインライン名編集 → 保存（`/api/pairs/:id/name`）
  - [ ] 「📝 内容を表示」トグルで内容列
  - [ ] 参加者かつ active 中：自己申告フォーム表示 → 時間＋内容3文字以上 → 「💾 記録」→ トースト → 再描画（`/api/races/:id/study`）
  - [ ] `.race-table` / `.race-rival` の見た目が従来通り
  - [ ] コンソールエラーなし

- [ ] **Step 5: `index.html` 回帰**（バッチ3は index.html 未変更なので原則影響なし。theme.css 追記の重複だけ確認）
  - [ ] ホームのレースセクション（`#race-section`）・バトルモーダルが従来通り

- [ ] **Step 6: メモリ更新** — `architecture-refactor-2026-09.md` の「フェーズ3」節に「バッチ3完了」を追記（ファイル一覧・コミット・未検証項目・残 = バッチ4〜6／フェーズ4）。

- [ ] **Step 7: コミット確認** — `git log --oneline -6` に `refactor(3-3)` ×4（theme.css / predict / battle / race）

---

## Self-Review

**1. Spec coverage（design doc フェーズ3）:** 「`battle.html` / `race.html` 作成」→ 本計画でカバー。`predict.html`（design doc の「`test`」＝ nav の「テスト予測」）も。`admin.html` / `survey.html` / `login.html` はバッチ4-5。✓

**2. Placeholder scan:** Task 1/2/3/4 は「`index.html:NNN-MMM` を VERBATIM コピー」＋バイト一致照合スクリプトを与える移植タスク。新規に書くコード（スキャフォールドの auth ブリッジ＋`updateAuthBar` シム、各 `refresh*Page`、`loadRaceSection` の1行書き換え版）は全文明記。移植部分の逐語 CSS/JS を計画に貼らないのは意図的（バッチ2で確立した方式）。

**3. Type consistency:**
- `refreshPredictPage` / `refreshBattlePage` — Task 2/3 で定義、`onAuthReady` から呼ぶ。名前一致 ✓
- `updateAuthBar()` — スキャフォールドで定義（`appShell.refreshAuth()` シム）、`predict.html` の移植コードが呼ぶ ✓
- `onAuthReady()` — 全ページ定義、スキャフォールドのリスナから ✓
- `authPoints` / `authLifetimePoints` / `authUserId` — スキャフォールドで宣言＆`_syncAuthGlobals` で設定、移植コードが参照 ✓
- `_currentRace` — Task 4 で宣言（`index.html:3434` と同一） ✓
- `_battleSides` — Task 3 で移植（`index.html` の `const _battleSides = {}` を含める） ✓
- `PRED_DEADLINE` — Task 2 で定義（`index.html:1813` と同一文字列） ✓
