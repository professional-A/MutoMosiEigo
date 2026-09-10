# フェーズ3 バッチ5 — 管理者ページ `admin.html` 独立化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `index.html` の管理者モーダル `#admin-modal-bg` とその配下の4サブモーダル（日程・時間割・レース発行・ペア設定）＋関連関数群を、独立した `admin.html` に切り出し、直リンク可能にする。管理者以外がURL直打ちしても操作UIを出さない。

**Architecture:** バッチ2〜4と同じマルチページ方式。`supabase(CDN)` → `/styles/theme.css` → `/js/api.js` → `/js/nav.js` → `/js/app-shell.js` → `/js/util.js` を読み、`appShell.mount(bar, { nav: window.APP_NAV, onNotif: ()=>location.href='/' })`。`authToken`/`authEmail` を `appshell:auth` から橋渡し。**管理者判定は `appShell.user.isAdmin`**（app-shell が `me.email === 'kabu6113450@gmail.com'` で計算）。非管理者には「権限がありません」を表示しコンテンツを描画しない。移植コードは `index.html` から**バイト一致**で持ってくる。

**方針メモ（重要）:**
- **バッチ5も「追加のみ」。`index.html` は一切変更しない。** モーダル markup・nav onClick・CSS の撤去はバッチ6。
- **サブモーダルはモーダルのまま移植する（「セクション化」はしない）。** メモリの当初案は「日程/時間割/ペア設定/レース発行をセクション化」だが、本バッチは最大の抽出作業なので、UX 再設計を上乗せするとリスクが跳ねる。目的（直リンク可能な管理ページ／index.html から切り離す土台）はモーダルのままでも達成できる。セクション化は後日のポリッシュ。
- **`closeAdminModal()` は no-op シムにする。** `openPairModal` / `openRaceModal` などが冒頭で `closeAdminModal()` を呼ぶ（元は「管理モーダルを閉じてサブモーダルを開く」導線）。admin.html ではページ自体が管理画面なので閉じる対象が無い。全呼び出し箇所をバイト一致で残すため `function closeAdminModal(){}` を定義する。
- **`index.html` に残すもの（バッチ5では触らない・バッチ6で撤去）:** `#admin-modal-bg` ほか5モーダルの markup、上記関数群、nav の `onClick: openAdminModal`。
- **`index.html` に残す「管理じゃない」関数（コピーしない）:** `renderTimetable` / `toggleTimetable`（トップの時間割掲示ウィジェット）、`loadBanners` / `deleteBanner`（トップのお知らせ）、`openBattleModal` 系（バッチ3）、`openScoresModal` 系（バッチ2）、`openRaceView` / `_renderRace` / `editPairName` / `savePairName` / `submitRaceAll` 系（バッチ3）。
- **サーバ側:** `/api/admin/*` は元々サーバでガードされている前提。admin.html の UI ガードは二重の安全策。

---

## File Structure

| ファイル | 役割 | 変更種別 |
|---|---|---|
| `styles/theme.css` | 末尾に追記：`.admin-card` 系（index.html:210-219）・`.tt-row` 系（index.html:40-41） | 追記のみ |
| `admin.html` | 管理者ページ。ユーザー一覧＋アクションボタン群＋4サブモーダル（日程・時間割・レース発行・ペア設定）。管理者ガードあり。 | 新規 |
| `index.html` | **変更なし** | — |

## 共通スキャフォールド

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>管理 ・ 武藤模試</title>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<link rel="stylesheet" href="/styles/theme.css">
<style>
  body{margin:0;background:var(--bg);color:var(--ink);font-family:'Fraunces',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  #app-shell-bar{position:fixed;top:0;left:0;right:0;z-index:100}
  main{max-width:720px;margin:0 auto;padding:72px 16px 48px}
  main h1{font-size:1.15rem;margin:8px 0 14px}
  #admin-actions{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
  #admin-actions button{padding:10px 12px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.88rem;font-weight:600}
  #admin-guard-msg{color:var(--dim);font-size:.9rem;padding:24px 0}
</style>
</head>
<body>
<div id="app-shell-bar"></div>
<main>
  <div id="admin-guard-msg" hidden>権限がありません。管理者アカウントでログインしてください。</div>
  <div id="admin-root" hidden>
    <h1>登録ユーザー一覧 <span id="admin-count" style="font-size:.8rem;color:var(--muted);font-weight:400"></span></h1>
    <div id="admin-content" style="margin-top:8px"></div>
    <div id="admin-actions">
      __ADMIN_BUTTONS__
    </div>
  </div>
</main>

__SUB_MODALS__

<script src="/js/api.js"></script>
<script src="/js/nav.js"></script>
<script src="/js/app-shell.js"></script>
<script src="/js/util.js"></script>
<script>
let authToken = null, authUser = null, authEmail = null, authUserId = null;
function _syncAuthGlobals() {
  var u = window.appShell && window.appShell.user;
  authToken  = (window.appShell && window.appShell.token) || null;
  authUser   = u ? u.username : null;
  authEmail  = u ? (u.email || '') : null;
  authUserId = u ? u.id : null;
}
function closeAdminModal(){}   // ページ自体が管理画面。サブモーダルを開く導線が呼ぶので no-op で残す。
function updateAuthBar(){ if (window.appShell) window.appShell.refreshAuth(); }

window.addEventListener('appshell:auth', function () {
  _syncAuthGlobals();
  var isAdmin = !!(window.appShell && window.appShell.user && window.appShell.user.isAdmin);
  document.getElementById('admin-guard-msg').hidden = isAdmin;
  document.getElementById('admin-root').hidden = !isAdmin;
  if (isAdmin) refreshAdminPage();
});

appShell.mount(document.getElementById('app-shell-bar'), {
  nav: window.APP_NAV,
  onNotif: function () { location.href = '/'; }
});

// index.html:openAdminModal を改名。lockScroll()/classList.add('open') を除去し
// Promise.all の中身だけ残す。
async function refreshAdminPage() {
  await Promise.all([reloadAdminContent(), updateLockBtn(), updateScoreLockBtn()]);
}

__ADMIN_JS__
</script>
</body>
</html>
```

---

## Task 1: `styles/theme.css` — 管理カード CSS を追記

**Files:** Modify `styles/theme.css`（末尾に追記）。参照元: `index.html:210-219`（`.admin-card` 系）、`index.html:40-41`（`.tt-row` 系）。

- [ ] **Step 1:** Run `sed -n '40,41p;210,219p' index.html` で対象を確認。
- [ ] **Step 2:** `styles/theme.css` の末尾に追記：

```css

/* --- 管理カード（index.html:210-219） --- */
<index.html:210-219 を VERBATIM。.admin-card / .admin-card-top / .admin-card-name /
 .admin-card-email / .admin-card-stats / .admin-stat / .admin-stat span /
 .admin-card-grant / .admin-card-grant input / .admin-card-grant button>

/* --- 時間割行（index.html:40-41） --- */
<index.html:40-41 を VERBATIM。.tt-row / .tt-row:first-of-type>
```

- [ ] **Step 3:** 検証
```bash
node -e "
const fs=require('fs');const css=fs.readFileSync('styles/theme.css','utf8');
const need=['.admin-card','.admin-card-top','.admin-card-name','.admin-card-email','.admin-card-stats','.admin-stat','.admin-card-grant','.tt-row','.tt-row:first-of-type'];
let bad=0;for(const s of need){if(!css.includes(s)){console.log('MISSING',s);bad++;}}
console.log(bad?bad+' MISSING':'ALL PRESENT ('+need.length+')');
const o=(css.match(/{/g)||[]).length,c=(css.match(/}/g)||[]).length;console.log('braces',o,c,o===c?'BALANCED':'UNBALANCED');
const idx=fs.readFileSync('index.html','utf8').split('\n');
let m=0;for(const [a,b] of [[40,41],[210,219]])for(let i=a;i<=b;i++){const l=idx[i-1];if(l.trim()&&!css.includes(l)){console.log('未一致 index.html:'+i);m++;}}
console.log(m?m+' 行未一致':'全行一致');
"
```
Expected: `ALL PRESENT (9)` / `BALANCED` / `全行一致`

- [ ] **Step 4:** `/usr/bin/git status --porcelain` → ` M styles/theme.css` のみ
- [ ] **Step 5:** コミット
```bash
/usr/bin/git add styles/theme.css
/usr/bin/git commit -m "$(cat <<'EOF'
refactor(3-5): 管理カード CSS を theme.css に追記

index.html <style>:210-219/40-41 と同一。撤去はバッチ6。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KM28JJxt3JocdSahvonhec
EOF
)"
```

---

## Task 2: `admin.html` — スキャフォールド＋ガード＋メイン＋アクション関数（前半）

**Files:** Create `admin.html`。参照元: `index.html:727-760`（`#admin-modal-bg` markup）、`index.html:2285-2392`（ブロックA）、`index.html:2613-2940`（ブロックB）。

- [ ] **Step 0: 実ソース確認**
```bash
sed -n '727,760p' index.html      # 管理モーダル markup（h2＋#admin-content＋ボタン28個）
sed -n '2285,2392p' index.html    # ブロックA: openAdminModal / reloadAdminContent / grantPoints / closeAdminModal / distributePool / awardWorstFrame / viewSurveyResults
sed -n '2613,2942p' index.html    # ブロックB: adminAddBanner / adminCreateBattles / adminCloseRace / adminAddBattlePair / adminRefundAllBattles / adminSettleManual / adminCloseBattles / adminSettleBattles / resetSeasonPoints / restoreSeasonPoints / debugPoints / restorePointsManual / adjustStudyLog / grantAll / awardBakaFrame / updateLockBtn / toggleSiteLock / updateScoreLockBtn / toggleRegistrationLock / toggleScoreLock
```
確認: 2285 `async function openAdminModal()`; 2342 `function closeAdminModal()`; 2363 `async function viewSurveyResults()` の直後（〜2392）に `async function openBattleModal()`（＝バッチ3のコード、**コピーしない**）が来る → ブロックA は `viewSurveyResults` の閉じ `}` で終わる。2613 `async function adminAddBanner()`; 2923 `async function toggleScoreLock()` の閉じ `}`（〜2940）の後は `document.getElementById('admin-modal-bg').addEventListener(...)`（**コピーしない**）→ 2972 `async function openScoresModal()`（バッチ2、コピーしない）。ブロックB は 2613〜`toggleScoreLock` の `}` まで。間に非管理関数が挟まっていないか目視（`adminAddBanner`〜`toggleScoreLock` は全て管理関数のはず）。境界が違ったら STOP して NEEDS_CONTEXT。

- [ ] **Step 1: `admin.html` を作成**

スキャフォールドの `__ADMIN_BUTTONS__` に、`index.html:731-756` のボタン群（`<button onclick="openScheduleModal()">📅 日程管理</button>` から `<button onclick="openPairModal()">👥 ペア設定</button>` まで）を VERBATIM でコピー。**ただし末尾の `<button onclick="closeAdminModal()">閉じる</button>`（757行）は入れない**（ページに閉じるボタン不要）。`id="reg-lock-btn"` / `id="lock-btn"` / `id="score-lock-btn"` はそのまま。

`__SUB_MODALS__` は Task 3 で埋めるので、Task 2 時点では空文字にしておく（`<!-- サブモーダルは Task 3 -->`）。

`__ADMIN_JS__` に：
```js
// ── ブロックA: index.html:2290-2392 VERBATIM（openAdminModal と closeAdminModal は除く）──
//   reloadAdminContent / grantPoints / distributePool / awardWorstFrame / viewSurveyResults
<PASTE reloadAdminContent, grantPoints, distributePool, awardWorstFrame, viewSurveyResults VERBATIM>

// ── ブロックB: index.html:2613-2940 VERBATIM ──
<PASTE adminAddBanner, adminCreateBattles, adminCloseRace, adminAddBattlePair, adminRefundAllBattles, adminSettleManual, adminCloseBattles, adminSettleBattles, resetSeasonPoints, restoreSeasonPoints, debugPoints, restorePointsManual, adjustStudyLog, grantAll, awardBakaFrame, updateLockBtn, toggleSiteLock, updateScoreLockBtn, toggleRegistrationLock, toggleScoreLock VERBATIM>
```
`openAdminModal` は **コピーしない**（スキャフォールドの `refreshAdminPage` が相当）。`closeAdminModal` も **コピーしない**（スキャフォールドが no-op で定義済み）。それ以外は 1 文字も変えない。

> **注意:** `reloadAdminContent` は `#admin-count` と `#admin-content` を id で参照 → markup に含まれる。`updateLockBtn`/`updateScoreLockBtn` は `#lock-btn`/`#reg-lock-btn`/`#score-lock-btn` を参照 → ボタン群に含まれる。`viewSurveyResults` はアンケート結果を alert/新規表示するだけ。`adjustStudyLog` / `restorePointsManual` / `debugPoints` などは `prompt()`/`alert()` を使う（管理者が操作する想定なのでそのまま）。

- [ ] **Step 2: 構文チェック**
```bash
node -e "const fs=require('fs');const h=fs.readFileSync('admin.html','utf8');fs.writeFileSync('/tmp/a.js',[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n;\n'));" && node --check /tmp/a.js
```
Expected: 出力なし・exit 0

- [ ] **Step 3: バイト一致照合**
```bash
node -e "
const fs=require('fs');
const idx=fs.readFileSync('index.html','utf8'), ag=fs.readFileSync('admin.html','utf8');
function blk(s,sig){const a=s.indexOf(sig);if(a<0)return null;let i=s.indexOf('{',a),d=0;for(;i<s.length;i++){if(s[i]==='{')d++;else if(s[i]==='}'){d--;if(!d)return s.slice(a,i+1);}}}
const names=['async function reloadAdminContent()','async function grantPoints(userId)','async function distributePool()','async function awardWorstFrame()','async function viewSurveyResults()','async function adminAddBanner()','async function adminCreateBattles()','async function adminCloseRace()','async function adminAddBattlePair()','async function adminRefundAllBattles()','async function adminSettleManual()','async function adminCloseBattles()','async function adminSettleBattles()','async function resetSeasonPoints()','async function restoreSeasonPoints()','async function debugPoints()','async function restorePointsManual()','async function adjustStudyLog()','async function grantAll()','async function awardBakaFrame()','async function updateLockBtn()','async function toggleSiteLock()','async function updateScoreLockBtn()','async function toggleRegistrationLock()','async function toggleScoreLock()'];
let bad=0;
for(const sig of names){ const b=blk(idx,sig); const ok=b&&ag.includes(b); if(!ok)bad++; console.log((ok?'OK  ':'BAD ')+sig); }
console.log('openAdminModal NOT copied:', !ag.includes('function openAdminModal')?'OK':'BAD');
console.log('closeAdminModal is no-op shim:', /function closeAdminModal\(\)\s*{\s*}/.test(ag)?'OK':'BAD');
console.log('openBattleModal NOT copied:', !ag.includes('function openBattleModal')?'OK':'BAD');
console.log('openScoresModal NOT copied:', !ag.includes('function openScoresModal')?'OK':'BAD');
console.log(bad?bad+' BAD':'ALL 25 IDENTICAL');
"
```
Expected: 全 `OK` / `ALL 25 IDENTICAL`

- [ ] **Step 4: 静的サーバ**
```bash
(python3 -m http.server 8135 >/dev/null 2>&1 & echo $! >/tmp/s.pid); sleep 1
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8135/admin.html
curl -s http://localhost:8135/admin.html | grep -c 'id="admin-content"\|id="admin-guard-msg"\|id="lock-btn"\|onclick="distributePool()"\|onclick="openPairModal()"'
kill $(cat /tmp/s.pid) 2>/dev/null
```
Expected: `200` と `5`

- [ ] **Step 5:** `/usr/bin/git status --porcelain` → `?? admin.html` のみ
- [ ] **Step 6: コミット**
```bash
/usr/bin/git add admin.html
/usr/bin/git commit -m "$(cat <<'EOF'
refactor(3-5): admin.html を作成（ガード＋ユーザー一覧＋アクション関数）

管理者判定 appShell.user.isAdmin、非管理者には権限メッセージ。
index.html:2290-2392/2613-2940 から25関数をバイト一致移植。
openAdminModal→refreshAdminPage、closeAdminModal は no-op シム。
サブモーダルは Task 3。index.html はバッチ6まで温存。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KM28JJxt3JocdSahvonhec
EOF
)"
```

---

## Task 3: `admin.html` — 4サブモーダル（日程・時間割・レース発行・ペア設定）

**Files:** Modify `admin.html`（`__SUB_MODALS__` 部分と `<script>` に追記）。参照元: markup = `index.html:810-846`（`#race-modal-bg`）・`847-858`（`#schedule-modal-bg`）・`861-874`（`#timetable-modal-bg`）・`875-889`（`#pair-modal-bg`）。関数 = `index.html:1345-1515`（時間割＋日程）・`index.html:3585-3653`（ペア設定＋変数）・`index.html:3728-3830`（レース発行＋変数）。

- [ ] **Step 0: 実ソース確認**
```bash
sed -n '810,890p' index.html          # race-modal-bg / schedule-modal-bg / timetable-modal-bg / pair-modal-bg の markup
sed -n '1345,1516p' index.html        # openTimetableModal / closeTimetableModal / saveTimetableRow / deleteTimetableRow / openScheduleModal / closeScheduleModal / archiveAllTests / saveSchedule
sed -n '3583,3654p' index.html        # _pairRaceId/_pairModalUsers/_pairGroupCount 宣言 + openPairModal / closePairModal / pairAddGroup / savePairs
sed -n '3728,3830p' index.html        # _raceModalUsers/_raceGroupCount 宣言 + openRaceModal / closeRaceModal / _renderRaceModalUsers / adminCreateRace
```
確認: 1289 `renderTimetable` と 1337 `toggleTimetable` は**トップの時間割ウィジェット**なのでコピーしない（1345 の `openTimetableModal` から）。3655 `editPairName` 以降はバッチ3（コピーしない）。3781 `adminCreateRace` の後 `// ── レース発行モーダル ──` の外（〜3830）で終わり。境界が違ったら STOP。

- [ ] **Step 1: markup を `__SUB_MODALS__` に**

`index.html` の以下4つの `<div class="modal-bg" id="...">…</div>` ブロックを VERBATIM でコピーして `</main>` の直後に置く（`__SUB_MODALS__` の位置）。**1文字も変えない**（`onclick="closeScheduleModal()"` 等もそのまま — 各サブモーダルの閉じるボタンはモーダルを閉じる正しい動作）:
- `#race-modal-bg`（index.html:810-846）
- `#schedule-modal-bg`（index.html:847-858）
- `#timetable-modal-bg`（index.html:861-874）
- `#pair-modal-bg`（index.html:875-889）

（正確な開始・終了行は Step 0 の `sed` で確認して合わせること。）

- [ ] **Step 2: 関数を `<script>` に追記**（`__ADMIN_JS__` の続き、`refreshAdminPage` の後ならどこでも可）

```js
// ── 時間割＋日程エディタ: index.html:1345-1515 VERBATIM ──
<PASTE openTimetableModal, closeTimetableModal, saveTimetableRow, deleteTimetableRow, openScheduleModal, closeScheduleModal, archiveAllTests, saveSchedule VERBATIM>

// ── ペア設定: index.html の _pairRaceId/_pairModalUsers/_pairGroupCount 宣言 + openPairModal, closePairModal, pairAddGroup, savePairs VERBATIM ──
<PASTE those 3 let-declarations + 4 functions VERBATIM>

// ── レース発行: index.html の _raceModalUsers/_raceGroupCount 宣言 + openRaceModal, closeRaceModal, _renderRaceModalUsers, adminCreateRace VERBATIM ──
<PASTE those 2 let-declarations + 4 functions VERBATIM>
```
`renderTimetable` / `toggleTimetable` は **コピーしない**。`openPairModal` / `openRaceModal` は冒頭で `closeAdminModal()` を呼ぶが、スキャフォールドの no-op シムが処理するのでそのままで良い。

- [ ] **Step 3: 構文チェック**（Task 2 Step 2 と同じコマンド）— exit 0

- [ ] **Step 4: バイト一致照合**
```bash
node -e "
const fs=require('fs');
const idx=fs.readFileSync('index.html','utf8'), ag=fs.readFileSync('admin.html','utf8');
function blk(s,sig){const a=s.indexOf(sig);if(a<0)return null;let i=s.indexOf('{',a),d=0;for(;i<s.length;i++){if(s[i]==='{')d++;else if(s[i]==='}'){d--;if(!d)return s.slice(a,i+1);}}}
const names=['async function openTimetableModal()','function closeTimetableModal()','async function saveTimetableRow(i)','async function deleteTimetableRow(id)','async function openScheduleModal()','function closeScheduleModal()','async function archiveAllTests()','async function saveSchedule(idx)','async function openPairModal()','function closePairModal()','function pairAddGroup(name = \'\', memberIds = [])','async function savePairs()','async function openRaceModal()','function closeRaceModal()','function _renderRaceModalUsers()','async function adminCreateRace()'];
let bad=0;
for(const sig of names){const b=blk(idx,sig);const ok=b&&ag.includes(b);if(!ok)bad++;console.log((ok?'OK  ':'BAD ')+sig);}
for(const n of ['function renderTimetable','function toggleTimetable','function editPairName','async function savePairName','function _renderRace(','async function submitRaceAll']){console.log(n+' NOT copied:', !ag.includes(n)?'OK':'BAD');}
for(const id of ['id=\"race-modal-bg\"','id=\"schedule-modal-bg\"','id=\"timetable-modal-bg\"','id=\"pair-modal-bg\"','id=\"pair-modal-pairs\"','id=\"schedule-content\"','id=\"timetable-content\"','id=\"race-name-input\"']){console.log(id+':', ag.includes(id)?'OK':'MISSING');}
console.log(bad?bad+' BAD':'ALL 16 IDENTICAL');
"
```
Expected: 全 `OK` / `ALL 16 IDENTICAL`

- [ ] **Step 5: 静的サーバ**
```bash
(python3 -m http.server 8135 >/dev/null 2>&1 & echo $! >/tmp/s.pid); sleep 1
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8135/admin.html
curl -s http://localhost:8135/admin.html | grep -c 'id="race-modal-bg"\|id="schedule-modal-bg"\|id="timetable-modal-bg"\|id="pair-modal-bg"'
kill $(cat /tmp/s.pid) 2>/dev/null
```
Expected: `200` と `4`

- [ ] **Step 6:** `/usr/bin/git status --porcelain` → ` M admin.html` のみ
- [ ] **Step 7: コミット**
```bash
/usr/bin/git add admin.html
/usr/bin/git commit -m "$(cat <<'EOF'
refactor(3-5): admin.html に4サブモーダルを追加（日程/時間割/レース発行/ペア設定）

markup=index.html:810-889、関数=index.html:1345-1515/3585-3653/3728-3830 を
バイト一致移植。renderTimetable/toggleTimetable（トップ掲示）は除外。
index.html はバッチ6まで温存。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KM28JJxt3JocdSahvonhec
EOF
)"
```

---

## Task 4: 実ブラウザ手動チェックリスト＋メモリ更新

**Files:** Modify `/Users/sho/.claude/projects/-Users-sho-work-MutoMosiEigo/memory/architecture-refactor-2026-09.md`。

- [ ] **Step 1: 段階1スモーク（静的サーバ or claude-in-chrome）**
  - [ ] `/admin.html` を未ログインで開く → 「権限がありません」表示・`#admin-root` は hidden・コンソールエラーなし
  - [ ] `window` に25＋16関数が定義されている（`typeof reloadAdminContent === 'function'` 等）
  - [ ] 4サブモーダルの markup が DOM にある（`#race-modal-bg` 等）
  - [ ] `closeAdminModal` が no-op（呼んでもエラーにならない）
- [ ] **Step 2: 段階2（要 `DATABASE_URL` or 本番・管理者アカウント）**
  - [ ] 管理者でログイン → ユーザー一覧が出る（`.admin-card` レイアウト）、`#admin-count`
  - [ ] 各ロックボタンのラベル/色が状態を反映（`updateLockBtn`/`updateScoreLockBtn`）
  - [ ] 「👥 ペア設定」→ `#pair-modal-bg` が開く → ペア追加/保存（`/api/admin/pairs`）
  - [ ] 「🏁 レース発行」→ `#race-modal-bg` が開く → 発行（`/api/admin/races`）
  - [ ] 「📅 日程管理」→ `#schedule-modal-bg` → 保存（`saveSchedule`）
  - [ ] 「🗓 時間割」→ `#timetable-modal-bg` → 行保存/削除
  - [ ] 破壊的操作（💰配分・🔄シーズンリセット・💸全返金）は**押さずに**、confirm ダイアログが出ることだけ確認
  - [ ] `grantPoints`（個別付与）が効く
- [ ] **Step 3: メモリ更新** — 「フェーズ3 バッチ5 完了」を追記（ファイル一覧・コミット・未検証項目・残＝バッチ6／フェーズ4）。
- [ ] **Step 4:** `git log --oneline -5` に `refactor(3-5)` ×3（theme.css / admin main / admin sub-modals）

---

## Self-Review

**1. Spec coverage:** design doc フェーズ3「`admin.html` を作成」「管理ページ内モーダル（日程/時間割）はページ内セクション or 子ページに」→ 本計画は `admin.html` 作成をカバー。「セクション化」は方針メモで明示的に見送り（モーダルのまま移植）＝ design doc の "or 子ページ" にも該当しない中間案だが、目的（直リンク・index 切り離し）は達成。バッチ6/後日でセクション化可能。

**2. Placeholder scan:** Task 2/3 は「`index.html:NNN` の関数を VERBATIM コピー」＋バイト一致照合スクリプト（25個＋16個）。新規記述はスキャフォールド（auth ブリッジ、`closeAdminModal` no-op、`updateAuthBar` シム、`refreshAdminPage`、ガード分岐）のみで全文明記。逐語コピーを計画に貼らないのはバッチ2〜4で確立した方式。

**3. Type consistency:**
- `refreshAdminPage` — スキャフォールドで定義、`appshell:auth` リスナから呼ぶ。`reloadAdminContent`/`updateLockBtn`/`updateScoreLockBtn` を呼ぶ（Task 2 で移植）。✓
- `closeAdminModal` — スキャフォールドで `function closeAdminModal(){}`。Task 3 の `openPairModal`/`openRaceModal` が冒頭で呼ぶ。✓
- `updateAuthBar` — スキャフォールドで `appShell.refreshAuth()` シム。移植関数のいくつか（`grantAll` 等）が呼ぶ可能性 → Step 3 の照合で移植コードは無改変なので、呼んでいれば shim が受ける。✓
- `authToken` / `authEmail` / `authUser` / `authUserId` — スキャフォールドで宣言＋`_syncAuthGlobals`。✓
- `_pairRaceId`/`_pairModalUsers`/`_pairGroupCount`/`_raceModalUsers`/`_raceGroupCount` — Task 3 で index.html の `let` 宣言ごと移植。✓
- markup id（`admin-content`/`admin-count`/`lock-btn`/`reg-lock-btn`/`score-lock-btn`/`race-modal-bg`/`schedule-modal-bg`/`timetable-modal-bg`/`pair-modal-bg`/`pair-modal-pairs`/`race-name-input` …）— Task 2/3 の markup に含まれ、移植関数が参照。✓
