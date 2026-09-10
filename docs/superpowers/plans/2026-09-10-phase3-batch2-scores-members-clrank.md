# フェーズ3 バッチ2 — 成績 / メンバー / クラス順位 を独立ページ化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `index.html` のモーダル／フルスクリーンページになっている「科目別成績」「メンバー一覧」「クラス順位予測」を、それぞれ独立した `scores.html` / `members.html` / `clrank.html` に切り出し、直リンク可能にする。

**Architecture:** マルチページ（ビルドツールなし・`express.static` のまま）。各ページは `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">` → `/styles/theme.css` → `/js/api.js` → `/js/nav.js` → `/js/app-shell.js` → `/js/util.js` の順で読み、`appShell.mount(el, { nav: window.APP_NAV })`（`manageAuth` は既定 true）で共通ヘッダー＋認証ブートストラップを得る。ページ本体は `index.html` から該当の markup / 関数 / 状態変数を移植し、`authToken` / `authUser` / `authUserId` / `authEmail` は `appshell:auth` イベント（`e.detail` と `appShell.token`）から橋渡しする。共通ヘルパ（`esc` / `tu` / `titleBadge` ほか）は新規 `js/util.js` に、共通コンポーネント CSS（`.ranking-table` 系・`.avatar`/`.frame-*` 系・`.shogou`/`.ti-*` 系・`.clrank-*` 系）は `styles/theme.css` に集約する。

**Tech Stack:** Vanilla JS（ES2020）、Express 静的配信、Supabase JS v2（CDN）、KaTeX 不使用。テストフレームワーク・リントなし → 検証は「`node --check` による構文チェック」＋「静的サーバ + `curl` で ID 存在確認」＋「実ブラウザ手動チェックリスト（Task 8）」。

**方針メモ（重要）:**
- **バッチ2は原則「追加のみ」。** `index.html` からの markup / 関数の削除は **フェーズ3 バッチ6** で行う。バッチ2で `index.html` を触るのは Task 7（`js/util.js` を読み込み、重複した共通ヘルパ定義だけを削除）のみ。`styles/theme.css` への CSS 追加は `index.html` の既存 `<style>` と同一内容の重複だが、同一ルールなので表示は不変（バッチ6で `index.html` 側を撤去）。
- ライブ機能（実ポイント連動は無いが、成績・順位・クラス順位はサーバ書き込みあり）。**各ページ作成後、必ず Task 8 の手動チェックリストで実ブラウザ確認**。
- 過去試験のデータのため、`clrank` の `localStorage`（`clrank_max_score`）以外に移行が必要な永続状態は無い。

---

## File Structure

| ファイル | 役割 | 変更種別 |
|---|---|---|
| `js/util.js` | 全ページ共通の小ヘルパ：`esc` / `tu` / `titleBadge` ＋称号ローテーション `setInterval`、`showPointToast`。`window.*` にぶら下げる。 | 新規 |
| `styles/theme.css` | 末尾に「共通コンポーネント」節を追記：`.table-scroll` / `.ranking-table` / `.rank-*`、`.avatar*` / `.frame-*` ＋関連 `@keyframes`、`.shogou*` / `.ti-*` ＋関連 `@keyframes`、`#clrank-page` / `.clrank-*`。 | 追記のみ |
| `members.html` | メンバー一覧ページ。`/api/members` を表示するだけ（認証不要）。 | 新規 |
| `scores.html` | 科目別成績ページ。`/api/scores` の表＋ソート＋「みっつー波多野ライン」、ログイン時は科目別点数入力（`/api/{ouri,math,kakougaku,nekku,seigyo}/score`）。 | 新規 |
| `clrank.html` | クラス順位予測ページ（2Dボード＋プール＋確定合計点パネル）。`/api/class-rank`（GET/POST）・`/api/class-rank/confirm`（POST）。 | 新規 |
| `index.html` | `<script src="/js/util.js">` を追加し、重複する `esc` / `tu` / `titleBadge` / `_rotateTick` ＋その `setInterval` 2 行 / `showPointToast` の定義を削除（Task 7）。**モーダル markup・ナビ onClick はバッチ6まで温存。** | 微修正（Task 7 のみ） |

---

## 共通スキャフォールド（全ページ共通・各タスクで参照）

各新規ページの骨格。`__TITLE__` / `__MAIN__` / `__PAGE_CSS__` / `__PAGE_JS__` を差し替える。

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
  main{max-width:900px;margin:0 auto;padding:72px 16px 40px}
  main h1{font-size:1.15rem;margin:8px 0 16px}
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
// ── 認証橋渡し（index.html の authToken/authUser/... 相当を appShell から供給）──
let authToken = null, authUser = null, authUserId = null, authEmail = null;
function _syncAuthGlobals() {
  const u = window.appShell && window.appShell.user;
  authToken  = (window.appShell && window.appShell.token) || null;
  authUser   = u ? u.username : null;
  authUserId = u ? u.id : null;
  authEmail  = u ? (u.email || '') : null;
}
window.addEventListener('appshell:auth', () => { _syncAuthGlobals(); onAuthReady(); });

appShell.mount(document.getElementById('app-shell-bar'), {
  nav: window.APP_NAV,
  onNotif: () => { location.href = '/'; }   // このページにお知らせパネルは無い
});

__PAGE_JS__
</script>
</body>
</html>
```

**橋渡しの注意:**
- `appShell.mount` は `manageAuth !== false` なら内部で `resolveAuth()` を呼び、完了時に `appshell:auth` を発火する（未ログインでも `e.detail = null` で必ず発火）。よって各ページは `onAuthReady()` を「認証解決後の初回描画」として実装すればよい。
- `appshell:auth` 前にページ内容を出しておきたい場合は、`onAuthReady()` とは別に「認証不要の初期描画」を mount 直後に一度呼ぶ（`members.html` はこれで十分、`scores.html` も表本体は認証不要）。

---

## Task 1: `js/util.js` — 共通ヘルパ

**Files:**
- Create: `js/util.js`
- 参照元: `index.html:1709-1711`（`esc` / `tu` / `titleBadge` 開始）〜 `index.html:1749`（ローテーション `setInterval`）、`index.html:1827-1833`（`showPointToast`）

- [ ] **Step 1: `js/util.js` を新規作成**

`index.html` の以下をそのまま移し、`window.` に公開する。`esc` / `tu` / `titleBadge` / `_rotateTick` の本体は **1 文字も変えない**（`index.html:1709-1749` の内容）。

```js
// 全ページ共通の小ヘルパ。<script src="/js/util.js"> で読む。
// index.html からの切り出し（フェーズ3 バッチ2）。定義は index.html:1709-1749 / 1827-1833 と同一。
(function () {
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function tu(s){ const str = s ? String(s) : ''; return str.length > 10 ? str.slice(0,10)+'…' : str; }
  function titleBadge(u){
    const cls = u.title_class || '';
    const syms = {
      'title-tanaka':'✦','title-hiroto':'❄','title-hasegawa':'♡',
      'title-pro':'♟','title-arashi':'⚠','title-eye':'☠',
      'title-hatano':'☣','title-honari':'…','title-mitts':'»',
      'title-kawakami':'〜','title-yoshi':'☁','title-shimesaba':'🌾',
      'title-ya':'⛔','title-masami':'♛'
    };
    const sym = syms[cls] || '◆';
    const rotateCls = new Set(['title-masami','title-pro']);
    let inner;
    if (cls === 'title-mitts') {
      inner = `<span class="ti-scroll">${sym} ${esc(u.title)}</span>`;
    } else if (rotateCls.has(cls) && u.title && u.title.includes('/')) {
      const parts = u.title.split('/');
      const items = parts.map((p, i) =>
        `<span class="ti-rotate-item${i===0?' active':''}">${esc(p.trim())}</span>`
      ).join('');
      const rotateMod = cls === 'title-pro' ? ' ti-instant' : '';
      inner = `${sym} <span class="ti-rotate${rotateMod}">${items}</span>`;
    } else {
      inner = `${sym} ${esc(u.title)}`;
    }
    return `<span class="shogou${cls?' '+cls:''}">${inner}</span>`;
  }

  function _rotateTick(sel) {
    document.querySelectorAll(sel).forEach(el => {
      const items = el.querySelectorAll('.ti-rotate-item');
      if (!items.length) return;
      let cur = 0;
      items.forEach((it, i) => { if (it.classList.contains('active')) cur = i; });
      items.forEach(it => it.classList.remove('active'));
      items[(cur + 1) % items.length].classList.add('active');
    });
  }
  setInterval(() => _rotateTick('.ti-rotate:not(.ti-instant)'), 3000);
  setInterval(() => _rotateTick('.ti-instant'), 2250);

  function showPointToast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#46d6c4;color:#0a1626;font-weight:700;padding:10px 20px;border-radius:99px;font-size:1rem;z-index:9999;pointer-events:none;transition:opacity .4s';
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 2500);
  }

  window.esc = esc;
  window.tu = tu;
  window.titleBadge = titleBadge;
  window._rotateTick = _rotateTick;
  window.showPointToast = showPointToast;
})();
```

- [ ] **Step 2: 構文チェック**

Run: `node --check js/util.js`
Expected: 出力なし・終了コード 0

- [ ] **Step 3: 参照元と文字一致を確認**

Run:
```bash
node -e "
const fs=require('fs');
const idx=fs.readFileSync('index.html','utf8');
const util=fs.readFileSync('js/util.js','utf8');
for (const name of ['function esc(s){','function tu(s){','function titleBadge(u){','function _rotateTick(sel){']) {
  const a=idx.indexOf(name), b=util.indexOf(name);
  console.log(name, a>=0 && b>=0 ? 'OK' : 'MISSING');
}
"
```
Expected: 4 行すべて `OK`

- [ ] **Step 4: コミット**

```bash
git add js/util.js
git commit -m "$(cat <<'EOF'
refactor(3-2): 共通ヘルパ js/util.js を切り出し（esc/tu/titleBadge/称号ローテ/showPointToast）

index.html:1709-1749/1827-1833 と同一定義。index.html 側の重複削除は Task 7。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KM28JJxt3JocdSahvonhec
EOF
)"
```

---

## Task 2: `styles/theme.css` — 共通コンポーネント CSS を追記

**Files:**
- Modify: `styles/theme.css`（末尾に追記）
- 参照元: `index.html:186-239`（modal / ranking / rank-*）、`index.html:307-390`（`.shogou` / `.ti-*` ＋ `@keyframes`）、`index.html:392-430`（`.avatar*` / `.frame-*` ＋ `@keyframes`）、`index.html:274-304`（`#clrank-page` / `.clrank-*`）

- [ ] **Step 1: 現状の `styles/theme.css` 末尾を確認**

Run: `tail -n 5 styles/theme.css`
Expected: 既存の内容が表示される（追記位置の確認）

- [ ] **Step 2: 追記対象ブロックを `index.html` から抽出して確認**

Run:
```bash
sed -n '225,235p;274,304p;307,390p;392,430p' index.html
```
Expected: `.table-scroll` / `.ranking-table` / `.rank-num` / `#clrank-page` / `.clrank-block` / `.shogou` / `.ti-scroll` / `.avatar` / `.frame-default` … などの定義が表示される。ここで表示された **各ルールの本文をそのまま** 次の Step でコピーする（プロパティ値は 1 文字も変えない）。

- [ ] **Step 3: `styles/theme.css` の末尾に「共通コンポーネント」節を追記**

以下の構成で追記する。**各ルールの中身は Step 2 で表示された `index.html` の該当行をそのままコピー**すること（本計画では冗長になるため列挙のみ。プロパティは改変禁止）。

```css

/* ==========================================================================
   共通コンポーネント（index.html の <style> から切り出し・フェーズ3 バッチ2）
   ※ index.html 側の同名ルールはフェーズ3 バッチ6 で撤去する。内容は完全同一。
   ========================================================================== */

/* --- テーブル（ランキング／成績／メンバー）: index.html:225-234, 236-239 --- */
.table-scroll{ /* index.html:225 */ }
.ranking-table{ /* index.html:226 */ }
.ranking-table th,.ranking-table td{ /* index.html:227 */ }
.ranking-table th{ /* index.html:228 */ }
.ranking-table tr:last-child td{ /* index.html:229 */ }
.rank-num{ /* index.html:230 */ }
.rank-num.top{ /* index.html:231 */ }
.rank-name{ /* index.html:232 */ }
.rank-score{ /* index.html:233 */ }
.rank-pct{ /* index.html:234 */ }
.ranking-login-note{ /* index.html:235 */ }
@media(max-width:480px){
  .ranking-table th,.ranking-table td{ /* index.html:237 */ }
}

/* --- アバター／フレーム: index.html:392-426 ＋ @keyframes worst-flash / baka-spin / moeru-flame / kusai-stink --- */
.avatar{ /* index.html:392 */ }
.avatar:hover{ /* index.html:393 */ }
.frame-default{ /* index.html:411 */ }
.frame-silver{ /* index.html:412 */ }
.frame-gold{ /* index.html:413 */ }
.frame-teal{ /* index.html:414 */ }
.frame-red{ /* index.html:415 */ }
.frame-purple{ /* index.html:416 */ }
.frame-rainbow{ /* index.html:417 */ }
.frame-worst{ /* index.html:418 */ }
.frame-baka{ /* index.html:420 */ }
.frame-moeru{ /* index.html:422 */ }
.frame-kusai{ /* index.html:424 */ }
/* ↑ index.html:392-426 の範囲を sed で確認し、間にある .avatar-lg / .avatar-grid など
   「アバター選択モーダル専用」のルールは移さない（バッチ4のアバターページで扱う）。
   frame-* に付随する @keyframes（worst-flash 等）は index.html 内の定義位置を
   `grep -n '@keyframes' index.html` で特定し、frame-* が参照するものだけ一緒に移す。 */

/* --- 称号バッジ: index.html:307-388 ＋ @keyframes mitts-scroll / ti-fade-in --- */
.shogou{ /* index.html:307-316 の複数行ブロック */ }
.shogou::before{ /* index.html:317-... */ }
/* index.html:307-390 を sed で確認し .shogou / .shogou::before / .ti-scroll /
   .ti-rotate / .ti-rotate-item / .ti-rotate-item.active / .ti-instant ...
   および @keyframes mitts-scroll, ti-fade-in をすべて移す */

/* --- クラス順位ボード: index.html:274-304 --- */
#clrank-page{ /* index.html:275 */ }
#clrank-page.open{ /* index.html:276 */ }
.clrank-ph{ /* index.html:277 */ }
.clrank-board-wrap{ /* index.html:278 */ }
.clrank-yaxis{ /* index.html:279 */ }
.clrank-board{ /* index.html:280 */ }
.clrank-pool-area{ /* index.html:281 */ }
.clrank-pool-row{ /* index.html:282 */ }
.clrank-block{ /* index.html:283 */ }
.clrank-block.selected{ /* index.html:284 */ }
/* index.html:283-304 の .clrank-block-conf / .clrank-conf-line-b(::before) /
   .clrank-grid-b / .clrank-yaxis-lbl / .clrank-chip(:hover)(.selected) も全部移す */
```

- [ ] **Step 4: `@keyframes` の依存を確認**

Run: `grep -n '@keyframes' index.html`
Expected: 一覧が出る。上で移した `.frame-worst`/`.frame-baka`/`.frame-moeru`/`.frame-kusai`/`.ti-scroll`/`.ti-rotate-item.active` が参照する keyframe 名（`worst-flash` `baka-spin` `moeru-flame` `kusai-stink` `mitts-scroll` `ti-fade-in`）が `styles/theme.css` にも存在することを確認（無ければ該当 `@keyframes` ブロックを `index.html` からコピー追記）。

Run: `grep -c 'worst-flash\|baka-spin\|moeru-flame\|kusai-stink\|mitts-scroll\|ti-fade-in' styles/theme.css`
Expected: `6` 以上（各 keyframe の定義＋参照）

- [ ] **Step 5: 静的サーバでスモーク（index.html の見た目が不変か）**

Run:
```bash
(python3 -m http.server 8123 >/dev/null 2>&1 & echo $! > /tmp/clsrv.pid); sleep 1
curl -s http://localhost:8123/styles/theme.css | grep -c 'clrank-block\|ranking-table\|frame-rainbow\|shogou'
kill $(cat /tmp/clsrv.pid)
```
Expected: `4` 以上（4 セレクタすべて theme.css に存在）

> 手動確認は Task 8 に集約（`index.html` を開いてランキング表・称号バッジ・アバターフレームが従来通りか）。

- [ ] **Step 6: コミット**

```bash
git add styles/theme.css
git commit -m "$(cat <<'EOF'
refactor(3-2): 共通コンポーネントCSSを theme.css に集約（table/avatar/frame/称号/clrank）

index.html <style> と同一ルールを追記（重複）。index.html 側の撤去はバッチ6。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KM28JJxt3JocdSahvonhec
EOF
)"
```

---

## Task 3: `members.html` — メンバー一覧ページ

**Files:**
- Create: `members.html`
- 参照元: `index.html:901-910`（モーダル markup）、`index.html:2988-3011`（`openMembersModal` 本体）

- [ ] **Step 1: `members.html` を共通スキャフォールドから作成**

`__TITLE__` = `メンバー一覧`

`__PAGE_CSS__`:
```css
  #members-content{font-size:.9rem;margin-top:8px}
```

`__MAIN__`:
```html
  <h1>👥 メンバー一覧</h1>
  <div id="members-content">読み込み中...</div>
```

`__PAGE_JS__`（`openMembersModal` の中身を「モーダルを開く」処理を除いて移植。`el` 取得先は同じ id `members-content`）:
```js
async function loadMembers() {
  const el = document.getElementById('members-content');
  try {
    const res  = await fetch('/api/members');
    const data = await res.json();
    if (!Array.isArray(data)) { el.innerHTML = 'エラー'; return; }
    el.innerHTML = `<div class="table-scroll"><table class="ranking-table">
        <thead><tr><th>#</th><th>名前</th></tr></thead>
        <tbody>${data.map((u, i) => `
          <tr>
            <td class="rank-num${Number(u.rank)<=3?' top':''}">${u.rank}</td>
            <td class="rank-name">
              <span class="avatar frame-${u.frame||'default'}" style="width:24px;height:24px;font-size:.9rem;margin-right:6px;vertical-align:middle">${u.avatar||'🐸'}</span>
              <span>
                ${esc(tu(u.username))}
                ${u.title ? `<br>${titleBadge(u)}` : ''}
              </span>
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
  } catch(e) { el.innerHTML = '読み込みエラー'; }
}

function onAuthReady() {}   // メンバー一覧は認証不要
loadMembers();
```

- [ ] **Step 2: 構文チェック（インライン script を抽出して `node --check`）**

Run:
```bash
node -e "
const fs=require('fs');
const h=fs.readFileSync('members.html','utf8');
const m=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n;\n');
fs.writeFileSync('/tmp/members.inline.js', m);
" && node --check /tmp/members.inline.js
```
Expected: 出力なし・終了コード 0

- [ ] **Step 3: 静的サーバで配信確認**

Run:
```bash
(python3 -m http.server 8123 >/dev/null 2>&1 & echo $! > /tmp/clsrv.pid); sleep 1
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8123/members.html
curl -s http://localhost:8123/members.html | grep -c 'id="app-shell-bar"\|id="members-content"\|/js/util.js\|/js/nav.js'
kill $(cat /tmp/clsrv.pid)
```
Expected: `200` と、2 行目が `4`

- [ ] **Step 4: コミット**

```bash
git add members.html
git commit -m "$(cat <<'EOF'
refactor(3-2): メンバー一覧を members.html に独立ページ化

/api/members の表示のみ（認証不要）。index.html:2988-3011 から移植。
index.html のモーダルはバッチ6まで温存。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KM28JJxt3JocdSahvonhec
EOF
)"
```

---

## Task 4: `scores.html` — 科目別成績ページ

**Files:**
- Create: `scores.html`
- 参照元: `index.html:913-935`（モーダル markup：入力ボタン群・`score-inline-wrap`）、`index.html:3021-3180`（`openScoresModal` / `loadScores` / `sortScores` ＋ `_scSort`）、`index.html:3852-3876`（`_submitScore` / `_confirmScoreInline` / `submit*Score` ×5）

- [ ] **Step 1: `scores.html` を共通スキャフォールドから作成**

`__TITLE__` = `科目別成績`

`__PAGE_CSS__`:
```css
  #scores-content{font-size:.85rem;margin-top:8px}
  .score-input-row{margin-top:14px;display:flex;gap:8px;flex-wrap:wrap}
  .score-input-row button{font-family:inherit;font-size:.85rem;padding:8px 16px;border-radius:10px;cursor:pointer}
```

`__MAIN__`（`index.html:916-930` のボタン群と inline-wrap をそのまま。`<h2>` は `<h1>` へ。閉じるボタンは不要なので削除）:
```html
  <h1>📊 科目別成績</h1>
  <div id="scores-content">読み込み中...</div>
  <div class="score-input-row" id="score-input-row">
    <button id="ouri-input-btn" style="display:none;border:1px solid var(--teal);background:rgba(70,214,196,.1);color:var(--teal)" onclick="submitOuriScore()">⚡ 応用物理の点数を入力</button>
    <button id="math-input-btn" style="display:none;border:1px solid var(--rose);background:rgba(240,107,142,.1);color:var(--rose)" onclick="submitMathScore()">📐 応用数学の点数を入力</button>
    <button id="kakougaku-input-btn" style="display:none;border:1px solid #f59e0b;background:rgba(245,158,11,.1);color:#f59e0b" onclick="submitKakougakuScore()">⚙️ 加工学の点数を入力</button>
    <button id="nekku-input-btn" style="display:none;border:1px solid #7c6af7;background:rgba(124,106,247,.1);color:#7c6af7" onclick="submitNekkuScore()">🔥 熱流体工学Ⅰの点数を入力</button>
    <button id="seigyo-input-btn" style="display:none;border:1px solid #a78bfa;background:rgba(167,139,250,.1);color:#a78bfa" onclick="submitSeigyoScore()">🎛️ 制御工学Ⅰの点数を入力</button>
  </div>
  <div id="score-inline-wrap" style="display:none;margin-top:10px;padding:10px 12px;background:rgba(70,214,196,.07);border:1px solid rgba(70,214,196,.3);border-radius:8px;align-items:center;gap:8px;flex-wrap:wrap">
    <span id="score-inline-label" style="font-size:.85rem;color:var(--dim)"></span>
    <input id="score-inline-val" type="number" min="0" max="100" placeholder="0〜100" style="width:80px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:#0a172b;color:var(--fg);font-size:.9rem;font-family:inherit" onkeydown="if(event.key==='Enter')_confirmScoreInline()">
    <button onclick="_confirmScoreInline()" style="padding:5px 14px;border:none;border-radius:6px;background:var(--teal);color:#0a1626;font-weight:700;cursor:pointer;font-size:.85rem">登録</button>
    <button onclick="document.getElementById('score-inline-wrap').style.display='none'" style="padding:5px 10px;border:1px solid var(--line);border-radius:6px;background:none;color:var(--dim);cursor:pointer;font-size:.85rem">✕</button>
  </div>
```

`__PAGE_JS__`（`index.html:3044-3180` の `_scSort` / `loadScores` / `sortScores` を**丸ごとコピー**。加えて `openScoresModal`（3021-3036）を「モーダルを開く」処理を除いた `refreshScoresPage()` に改名して移植。`_submitScore` / `_confirmScoreInline` / `submit*Score`（3852-3876）も**丸ごとコピー**。`_confirmScoreInline` 内の `await openScoresModal();` は `await refreshScoresPage();` に置換）:
```js
// ---- index.html:3044-3180 をそのままコピー ----
let _scSort = { key: '_avg', dir: 1 };
async function loadScores() { /* index.html:3045-3175 をそのまま */ }
function sortScores(key) { /* index.html:3176-3180 をそのまま */ }

// ---- index.html:3021-3036 の openScoresModal を改名して移植 ----
async function refreshScoresPage() {
  const seigyoActive = new Date() >= new Date('2026-06-23T00:00:00Z');
  const show = id => { const b = document.getElementById(id); if (b) b.style.display = authToken ? 'inline-block' : 'none'; };
  show('ouri-input-btn'); show('math-input-btn'); show('kakougaku-input-btn'); show('nekku-input-btn');
  const sb = document.getElementById('seigyo-input-btn');
  if (sb) sb.style.display = (authToken && seigyoActive) ? 'inline-block' : 'none';
  await loadScores();
}

// ---- index.html:3852-3876 をそのままコピー（openScoresModal 参照のみ置換）----
let _scoreEndpoint = '';
async function _submitScore(label, endpoint) { /* index.html:3853-3861 をそのまま */ }
async function _confirmScoreInline() {
  const n = parseInt(document.getElementById('score-inline-val').value, 10);
  if (isNaN(n) || n < 0 || n > 100) { alert('0〜100の整数で入力してください'); return; }
  try {
    const res  = await fetch(_scoreEndpoint, { method:'POST', headers:{'Content-Type':'application/json','Authorization':authToken}, body: JSON.stringify({ score: n }) });
    const data = await res.json();
    if (data.ok) { document.getElementById('score-inline-wrap').style.display = 'none'; await refreshScoresPage(); }
    else alert('❌ ' + (data.error || 'エラー'));
  } catch(e) { alert('通信エラー'); }
}
async function submitOuriScore()      { await _submitScore('応用物理', '/api/ouri/score'); }
async function submitMathScore()      { await _submitScore('応用数学', '/api/math/score'); }
async function submitKakougakuScore() { await _submitScore('加工学', '/api/kakougaku/score'); }
async function submitNekkuScore()     { await _submitScore('熱流体工学Ⅰ', '/api/nekku/score'); }
async function submitSeigyoScore()    { await _submitScore('制御工学Ⅰ', '/api/seigyo/score'); }

function onAuthReady() { refreshScoresPage(); }
loadScores();   // 認証解決前でも表本体は出す
```

> **注意:** `loadScores` は `authUser`（自分ハイライト）を参照する。`onAuthReady()` で `refreshScoresPage()`→`loadScores()` が再実行されるので、ログイン時は自分の行がハイライトされた状態に更新される。未ログインでも表は出る。

- [ ] **Step 2: 構文チェック**

Run:
```bash
node -e "
const fs=require('fs');
const h=fs.readFileSync('scores.html','utf8');
const m=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n;\n');
fs.writeFileSync('/tmp/scores.inline.js', m);
" && node --check /tmp/scores.inline.js
```
Expected: 出力なし・終了コード 0

- [ ] **Step 3: `loadScores` / `_submitScore` が原文と一致するか確認**

Run:
```bash
node -e "
const fs=require('fs');
const idx=fs.readFileSync('index.html','utf8');
const sc=fs.readFileSync('scores.html','utf8');
for (const s of ['みっつー波多野ライン','_scSort','rankMap','/api/ouri/score','/api/seigyo/score','_lineDesc']) {
  console.log(s, idx.includes(s) && sc.includes(s) ? 'OK' : 'MISSING in scores.html');
}
"
```
Expected: 6 行すべて `OK`

- [ ] **Step 4: 静的サーバで配信確認**

Run:
```bash
(python3 -m http.server 8123 >/dev/null 2>&1 & echo $! > /tmp/clsrv.pid); sleep 1
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8123/scores.html
curl -s http://localhost:8123/scores.html | grep -c 'id="scores-content"\|id="score-inline-wrap"\|ouri-input-btn\|seigyo-input-btn'
kill $(cat /tmp/clsrv.pid)
```
Expected: `200` と `4`

- [ ] **Step 5: コミット**

```bash
git add scores.html
git commit -m "$(cat <<'EOF'
refactor(3-2): 科目別成績を scores.html に独立ページ化

/api/scores の表・ソート・みっつー波多野ライン、ログイン時は科目別点数入力。
index.html:3021-3180/3852-3876 から移植（openScoresModal→refreshScoresPage）。
index.html のモーダルはバッチ6まで温存。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KM28JJxt3JocdSahvonhec
EOF
)"
```

---

## Task 5: `clrank.html` — クラス順位予測ページ

**Files:**
- Create: `clrank.html`
- 参照元: `index.html:938-985`（フルスクリーンページ markup：ヘッダー・ボード・プール・確定パネル）、`index.html:3183-3479`（`CLASS_NAMES` ＋ 状態変数 ＋ `loadClrankPage` 〜 `clrankEditConfirm`）

> **注意:** `clrank` は `index.html` では `#clrank-page`（`position:fixed;inset:0`）というフルスクリーンオーバーレイ。独立ページでは**ページ自体がそれ**なので、`#clrank-page` を `<main>` の代わりに直接置き、`.open` を常時付与、`openClrankPage`/`closeClrankPage` は「閉じる＝`/` に戻る」に読み替える。`#clrank-page` の `z-index`/`position:fixed` はページ全体で問題ないが、`app-shell-bar`（`z-index:100`）と重なるため `#clrank-page` を `top:46px`（バー高さ）に下げる。

- [ ] **Step 1: `clrank.html` を作成（スキャフォールドの `<main>…</main>` を丸ごと差し替え）**

`<head>` の `<style>` はスキャフォールド共通分に加えて:
```css
  /* app-shell バーの下にボードを収める */
  #clrank-page{top:46px}
```
（`#clrank-page` 本体・`.clrank-*` は `styles/theme.css`（Task 2）にある前提。無ければ Task 2 を先に完了させること）

`<body>` は:
```html
<div id="app-shell-bar"></div>

<!-- index.html:938-985 の #clrank-page ブロックをそのままコピー。
     ただし冒頭の onclick="closeClrankPage()" は onclick="location.href='/'" に、
     開閉制御が不要なので <div id="clrank-page"> に class="open" を付けておく -->
<div id="clrank-page" class="open">
  <div class="clrank-ph">
    <span style="font-weight:700;font-size:.86rem;white-space:nowrap;color:#d4e8ff">🏆 クラス順位予測</span>
    <span id="clrank-hint" style="flex:1;font-size:.66rem;color:rgba(70,214,196,.8);padding:0 8px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span>
    <button onclick="openClrankConfirmPanel()" style="padding:4px 10px;border:1px solid var(--teal);border-radius:6px;background:rgba(70,214,196,.1);color:var(--teal);font-size:.78rem;cursor:pointer;font-family:inherit;flex-shrink:0">📝 合計点入力</button>
    <button onclick="location.href='/'" style="padding:4px 10px;border:1px solid rgba(255,255,255,.15);border-radius:6px;background:none;color:var(--dim);font-size:.78rem;cursor:pointer;font-family:inherit;flex-shrink:0">✕ 閉じる</button>
  </div>
  <div class="clrank-board-wrap">
    <div class="clrank-yaxis" id="clrank-yaxis"></div>
    <div class="clrank-board" id="clrank-board" onclick="clrankBoardTap(event)"></div>
  </div>
  <div class="clrank-pool-area">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
      <span style="font-size:.62rem;color:var(--dim);white-space:nowrap">プール: <span id="clrank-pool-count">0</span>人</span>
    </div>
    <div class="clrank-pool-row" id="clrank-pool-inner"></div>
  </div>
  <!-- index.html:959-985 の #clrank-conf-panel をそのままコピー（clrank-conf-name / clrank-conf-score / clrankAddConfirm ボタンを含む） -->
  <div id="clrank-conf-panel" style="display:none;position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.55);backdrop-filter:blur(2px)" onclick="if(event.target===this)closeClrankConfirmPanel()">
    <!-- ...（index.html:960-985 を確認してそのままコピー：確定済みリスト clrank-confirmed-items / 新規追加フォーム / 追加ボタン onclick="clrankAddConfirm()"）... -->
  </div>
</div>
```

> Step 1 の実装前に `sed -n '938,990p' index.html` で `#clrank-conf-panel` の中身（`clrank-conf-name` / `clrank-conf-score` input と `clrankAddConfirm()` ボタン）を確認して正確にコピーすること。

`<script>` 追加分（スキャフォールドの `__PAGE_JS__`）:
```js
// ---- index.html:3183-3196 の定数・状態変数をそのままコピー ----
const CLASS_NAMES = [ /* index.html:3183-3190 の36名をそのまま */ ];
let _clrankPositions = {};
let _clrankMaxScore  = 300;
let _clrankMinScore  = 0;
let _clrankConfirmed = {};
let _clrankSel       = null;
let _clrankSelBoard  = false;

// ---- index.html:3209-3479 をそのままコピー ----
//   loadClrankPage / _clrankRenderAll / _scoreToTop / _clrankRenderYAxis /
//   _clrankRenderBoard / _clrankRenderPool / _clrankRenderHint /
//   _clrankRenderConfirmed / openClrankConfirmPanel / closeClrankConfirmPanel /
//   _clrankRenderAdminMs / clrankBoardTap / _clrankBlockTap / clrankPoolChipTap /
//   _saveClrankPositions / _clrankSetConfirmed / _clrankUnsetConfirmed /
//   clrankAddConfirm / clrankRemoveConfirm / clrankEditConfirm
//   （openClrankPage / closeClrankPage は移植しない。ページ自体がそれ）

function onAuthReady() {
  // 認証解決後に描画（_saveClrankPositions / clrankAddConfirm が authToken を使う）
  loadClrankPage();
}
```

> `loadClrankPage` は `authToken` を直接は使わないが、その中で呼ぶ `_saveClrankPositions` が `Authorization: authToken` を送る。`onAuthReady` で初回描画すれば、未ログイン時は `authToken=null`（`index.html` と同じ挙動）。**未ログインでもボード閲覧・ローカル操作はできるが保存は 401 になり得る**（`index.html` と同一の挙動なので許容）。

- [ ] **Step 2: 構文チェック**

Run:
```bash
node -e "
const fs=require('fs');
const h=fs.readFileSync('clrank.html','utf8');
const m=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n;\n');
fs.writeFileSync('/tmp/clrank.inline.js', m);
" && node --check /tmp/clrank.inline.js
```
Expected: 出力なし・終了コード 0

- [ ] **Step 3: 主要関数・定数が原文と一致するか確認**

Run:
```bash
node -e "
const fs=require('fs');
const idx=fs.readFileSync('index.html','utf8');
const cl=fs.readFileSync('clrank.html','utf8');
const names=['CLASS_NAMES','loadClrankPage','_clrankRenderBoard','_scoreToTop','clrankBoardTap','_saveClrankPositions','clrankAddConfirm','clrankEditConfirm','/api/class-rank/confirm','clrank_max_score'];
for (const n of names) console.log(n, idx.includes(n) && cl.includes(n) ? 'OK' : 'MISSING in clrank.html');
console.log('openClrankPage absent from clrank.html:', !cl.includes('function openClrankPage') ? 'OK' : 'SHOULD BE REMOVED');
"
```
Expected: 10 行 `OK` ＋ 最終行 `OK`

- [ ] **Step 4: 静的サーバで配信確認**

Run:
```bash
(python3 -m http.server 8123 >/dev/null 2>&1 & echo $! > /tmp/clsrv.pid); sleep 1
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8123/clrank.html
curl -s http://localhost:8123/clrank.html | grep -c 'id="clrank-board"\|id="clrank-pool-inner"\|id="clrank-conf-panel"\|clrankAddConfirm'
kill $(cat /tmp/clsrv.pid)
```
Expected: `200` と `4`

- [ ] **Step 5: コミット**

```bash
git add clrank.html
git commit -m "$(cat <<'EOF'
refactor(3-2): クラス順位予測を clrank.html に独立ページ化

2Dボード＋プール＋確定合計点パネル。index.html:3183-3479 から移植。
openClrankPage/closeClrankPage は廃し、ページ自体を #clrank-page に。
index.html のフルスクリーンページはバッチ6まで温存。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KM28JJxt3JocdSahvonhec
EOF
)"
```

---

## Task 6: 動作確認用に静的サーバ経由でリンクを通す（任意・確認のみ）

**Files:** なし（確認のみ）

- [ ] **Step 1: 3 ページが app-shell の APP_NAV から相互に飛べることを確認**

Run:
```bash
(python3 -m http.server 8123 >/dev/null 2>&1 & echo $! > /tmp/clsrv.pid); sleep 1
for p in members scores clrank; do
  echo -n "$p.html: "; curl -s -o /dev/null -w '%{http_code}' http://localhost:8123/$p.html; echo
done
curl -s http://localhost:8123/js/nav.js | grep -c "/members.html\|/scores.html\|/clrank.html"
kill $(cat /tmp/clsrv.pid)
```
Expected: 3 行とも `200`、最終行 `3`（`js/nav.js` は既にこの 3 href を持っている。Task 対象外）

---

## Task 7: `index.html` — `js/util.js` を読み込み、重複ヘルパ定義を削除

**Files:**
- Modify: `index.html`（`<script src="/js/util.js">` 追加、`esc`/`tu`/`titleBadge`/`_rotateTick`＋`setInterval` 2 行/`showPointToast` の定義削除）
- 参照: `index.html:1691-1692`（既存の script タグ並び）、`index.html:1709-1749`、`index.html:1827-1833`

> **なぜバッチ2でやるか:** 「共通ヘルパの切り出し」はメモリの引き継ぎでバッチ2の前提とされている。モーダル markup / ナビ onClick の撤去（＝バッチ6）とは別。これは低リスク（定義が `js/util.js` と 1 文字一致していることを Task 1 Step 3 で確認済み・読み込み順も `app-shell.js` の後で同じ）。

- [ ] **Step 1: `<script src="/js/util.js"></script>` を追加**

`index.html:1692`（`<script src="/js/app-shell.js"></script>`）の直後の行に追加:
```html
<script src="/js/app-shell.js"></script>
<script src="/js/util.js"></script>
<script>
```

- [ ] **Step 2: `index.html:1709-1711`〜`1736` の `esc` / `tu` / `titleBadge` 定義を削除**

`index.html` の以下を丸ごと削除（`function esc(s){…}` の行から `titleBadge` の閉じ `}` まで＝現行 1709-1736 行）。`_rotateTick` の定義（1738-1747）と `setInterval(...)` 2 行（1748-1749）も削除。

- [ ] **Step 3: `index.html` の `showPointToast` 定義（現行 1827-1833）を削除**

`function showPointToast(msg) { … }` を丸ごと削除（`js/util.js` に同一実装がある）。

- [ ] **Step 4: 他に重複定義が残っていないか確認**

Run: `grep -n 'function esc(\|function tu(\|function titleBadge(\|function _rotateTick(\|function showPointToast(' index.html`
Expected: **0 件**（すべて `js/util.js` 側に移動済み）

Run: `grep -n "src=\"/js/util.js\"" index.html`
Expected: 1 件（Step 1 で追加した行）

- [ ] **Step 5: 静的サーバでスモーク**

Run:
```bash
(python3 -m http.server 8123 >/dev/null 2>&1 & echo $! > /tmp/clsrv.pid); sleep 1
curl -s http://localhost:8123/index.html | grep -c 'src="/js/util.js"'
curl -s http://localhost:8123/index.html | grep -c 'function titleBadge('
kill $(cat /tmp/clsrv.pid)
```
Expected: 1 行目 `1`、2 行目 `0`

- [ ] **Step 6: コミット**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
refactor(3-2): index.html を js/util.js に載せ替え（重複ヘルパ定義を削除）

esc/tu/titleBadge/称号ローテ/showPointToast は js/util.js に一本化。
モーダル markup・ナビ onClick はバッチ6まで温存。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KM28JJxt3JocdSahvonhec
EOF
)"
```

---

## Task 8: 実ブラウザ手動チェックリスト＋メモリ更新

**Files:**
- Modify: `/Users/sho/.claude/projects/-Users-sho-work-MutoMosiEigo/memory/architecture-refactor-2026-09.md`（進捗追記）
- Modify: `/Users/sho/.claude/projects/-Users-sho-work-MutoMosiEigo/memory/MEMORY.md` は変更不要（既存行で足りる）

- [ ] **Step 1: `npm start` でサーバ起動（`DATABASE_URL` 必須）**

Run: `npm start`（ユーザーに依頼。DB env が無ければ静的サーバ `python3 -m http.server` で UI のみ確認）
Expected: `localhost:3000` で起動

- [ ] **Step 2: `index.html`（ホーム）が従来通りか — CSS/ヘルパ切り出しの回帰確認**

- [ ] ランキング表（`.ranking-table`）が従来の見た目
- [ ] 称号バッジ（`.shogou` / ローテーション `title-pro` `title-masami` / スクロール `title-mitts`）が動く
- [ ] アバターのフレーム（`.frame-rainbow` `.frame-moeru` などのアニメ）が従来通り
- [ ] コンソールにエラーなし（特に `esc is not defined` `titleBadge is not defined`）
- [ ] ヘッダーの各モーダル（成績・メンバー・クラス順位）が **従来通りまだ開く**（バッチ2では未撤去）

- [ ] **Step 3: `/members.html`**

- [ ] app-shell バー表示、ハンバーガー → 各ページへ `<a href>` 遷移できる
- [ ] メンバー一覧が rank 順に出る／アバター・称号バッジが出る
- [ ] 未ログインでも表示される（`/api/members` は認証不要）
- [ ] コンソールエラーなし

- [ ] **Step 4: `/scores.html`**

- [ ] 未ログイン：表・ソート（列ヘッダクリックで昇降）・「みっつー波多野ライン」表示
- [ ] ログイン後：自分の行がハイライト（`👈`）、科目別入力ボタンが出る（制御工学は 2026-06-23 以降のみ）
- [ ] 入力ボタン → inline-wrap 出現 → 0〜100 入力 → 登録 → 表が更新される（実 POST。テスト用に自分のアカウントで）
- [ ] `_scoreLocked`（管理で締切済み）時はサーバが弾く／エラーメッセージ表示
- [ ] コンソールエラーなし

- [ ] **Step 5: `/clrank.html`**

- [ ] ボード（Y 軸目盛・グリッド）とプール（未配置者チップ）が出る
- [ ] プールのチップをタップ → ボードをタップで配置 → リロードで位置が復元（`/api/class-rank` POST）
- [ ] 配置済みブロックを 2 度タップでプールに戻る
- [ ] 「📝 合計点入力」→ パネル表示 → 名前＋点数追加 → 確定線が引かれる（`/api/class-rank/confirm` POST）／✕ で削除／タップで編集（prompt）
- [ ] 合計点（max_score）が増えたときの「確定線→ブロック変換」再配置（`clrank_max_score` localStorage 依存）※再現できる場合のみ
- [ ] 「✕ 閉じる」で `/` に戻る
- [ ] コンソールエラーなし

- [ ] **Step 6: メモリ更新**

`architecture-refactor-2026-09.md` の「フェーズ3」節に追記:
```markdown
- **フェーズ3 バッチ2 完了（未 push / コミット `refactor(3-2)` ×6）:** `js/util.js` 新規（esc/tu/titleBadge/称号ローテ/showPointToast、index.html:1709-1749/1827-1833 と同一）。`styles/theme.css` に共通コンポーネントCSS（.ranking-table系/.avatar・.frame-*系＋keyframes/.shogou・.ti-*系＋keyframes/.clrank-*・#clrank-page）を追記（index.html <style> と重複。撤去はバッチ6）。`members.html`（/api/members のみ・認証不要）/`scores.html`（/api/scores 表・ソート・みっつー波多野ライン・科目別点数入力、openScoresModal→refreshScoresPage）/`clrank.html`（2Dボード＋プール＋確定パネル、openClrankPage/closeClrankPage 廃止・ページ自体を #clrank-page に、app-shell バー分 top:46px）を新規。各ページは supabase→theme.css→api.js→nav.js→app-shell.js→util.js を読み `appShell.mount({nav:APP_NAV})`、authToken/authUser/authUserId/authEmail は `appshell:auth` から橋渡し。`index.html` は util.js 読み込み＋重複ヘルパ定義削除（モーダル markup・ナビ onClick はバッチ6まで温存）。
- **未検証:** 実ブラウザでの members/scores/clrank 描画・実 POST（成績入力・順位保存・確定合計点）・index.html 回帰（称号/フレーム/ランキング表）。`node --check`＋静的サーバ curl は済み。
- 残: フェーズ3 バッチ3〜6／フェーズ4。
```

- [ ] **Step 7: 全コミット確認**

Run: `git log --oneline -8`
Expected: `refactor(3-2)` のコミットが 6 本（util.js / theme.css / members / scores / clrank / index.html）並ぶ

---

## Self-Review

**1. Spec coverage（`docs/superpowers/specs/2026-09-10-architecture-refactor-design.md` フェーズ3）:**
- 「`scores.html` / `battle.html` / `race.html` / `admin.html` / `survey.html` を作成」→ 本計画は `scores` / `members` / `clrank` の 3 つ（メモリのバッチ割り＝バッチ2）。`battle`/`race`/`predict` はバッチ3、`survey`/`login` はバッチ4、`admin` はバッチ5。✓ 部分カバー（意図通り）
- 「各ページは `theme.css` + `api.js` + `app-shell.js` を読み、本体だけを持つ」→ 共通スキャフォールドで担保（＋ `nav.js` / `util.js`）。✓
- 「`APP_SHELL_NAV_OVERRIDES` を外して素の `href` 遷移に」→ 新規ページは最初から `APP_NAV`（素の href）。`index.html` の override 撤去はバッチ6（明記）。✓
- 「`index.html` は目次だけになる」→ バッチ6。本計画では `index.html` のモーダルを温存（明記）。✓

**2. Placeholder scan:** Task 2 は CSS 本文を「`index.html:NNN` をそのままコピー」と指示（列挙のみ）。これは ~130 行の逐語 CSS を計画に貼るのを避けるための明示的な委譲で、コピー元の行番号・確認用 `sed`・keyframe 依存チェック・`grep -c` 検証を与えている。Task 4/5 も同様に「`index.html:NNN-MMM` をそのままコピー」＋一致確認スクリプトを与えている。移植（＝逐語コピー）タスクの性質上これは許容。新規に書くコード（認証橋渡し・`refreshScoresPage`・`_confirmScoreInline` の参照置換）は全文を明記済み。

**3. Type consistency:**
- `refreshScoresPage()` — Task 4 で定義、`_confirmScoreInline` / `onAuthReady` から呼ぶ。名前一致 ✓
- `onAuthReady()` — 全ページで定義、スキャフォールドの `appshell:auth` リスナから呼ぶ。名前一致 ✓
- `_syncAuthGlobals()` — スキャフォールドで定義・呼び出し。✓
- `authToken` / `authUser` / `authUserId` / `authEmail` — スキャフォールドで `let` 宣言、各移植関数が参照。`index.html` と同名なので移植コードの改変不要 ✓
- `window.esc` / `window.tu` / `window.titleBadge` — Task 1 で公開、Task 3/4 の移植コードがグローバル参照 ✓
- `_scSort` — Task 4 で `let` 宣言（`index.html:3044` と同一）✓
- `CLASS_NAMES` / `_clrankPositions` ほか clrank 状態 — Task 5 で宣言（`index.html:3183-3196` と同一）✓
