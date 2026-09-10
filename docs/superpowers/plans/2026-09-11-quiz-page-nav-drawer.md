# 模試ページのナビゲーションドロワー Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 模試ページ（`quiz.html` / `quiz-engine.js`）の採点バー右端にハンバーガー `☰` を足し、そこから「同じ試験の同科目の他の模試 → 同じ試験の他科目 → 分離ページ（メニュー）」へ直接飛べるドロワーを開けるようにする。

**Architecture:** ドロワーのロジックは新規 `js/quiz-nav.js`（IIFE、`window.quizNav.mount(data)` を公開）に閉じ込める。`quiz-engine.js` は `initQuiz` の末尾で `js/nav.js`（`APP_NAV` 定義）→ `js/quiz-nav.js` の順に読み込んで `mount` を呼ぶだけ。見た目は既存の `.appshell-drawer` / `.appshell-backdrop`（`styles/theme.css`、純 CSS で `.open` の付け外しだけで動く）を流用し、グループ見出し用のクラスを1つ足す。フル `app-shell` は mount しない（認証・共通ヘッダーは載せない）。

**Tech Stack:** 素の JS（ES5 相当、`app-shell.js` の書き方に合わせる）、`fetch`、`express.static` のまま。ビルドツール・テストフレームワーク・lint は無い（`CLAUDE.md`）。検証はブラウザで手動。

**設計書:** `docs/superpowers/specs/2026-09-11-quiz-page-nav-drawer-design.md`

---

## File Structure

| ファイル | 区分 | 責務 |
|---|---|---|
| `js/quiz-nav.js` | 新規 | 模試ページ専用ドロワー。`☰` ボタン注入・ドロワー DOM 生成・開閉・`/api/tests` 取得と3グループ描画。`window.quizNav.mount(data)` を公開。`js/util.js` には依存しない（`esc` を内蔵）。`window.APP_NAV` には依存する。 |
| `js/quiz-engine.js` | 変更 | `initQuiz` 内の `window.QUIZ_SUBJECT = data.subject;` の直後に、`js/nav.js` → `js/quiz-nav.js` を読み込んで `window.quizNav.mount(data)` を呼ぶ4行を追加するだけ。DOM 再構成なし。 |
| `styles/theme.css` | 変更 | `.appshell-drawer-group`（グループ見出し）と `.appshell-drawer span[aria-current="page"]`（表示中の項目）と `.scoreboard .appshell-hamburger`（バー内での大きさ調整）の3ルールを追加。既存 `.appshell-*` は変更しない。 |

前提となるデータ: 各テストの `data.json` は `year`(数値)・`grade`(数値)・`exam`(文字列)・`subject`(文字列)・`title`(文字列) を持つ（`CLAUDE.md` の索引仕様で必須）。`GET /api/tests` は `{year, grade, exam, subject, title, storageKey, totalItems, type, path}` のフラット配列を返す（`tests-index.js`）。各エントリの `path` は `/quiz.html?d=tests/<dir>/data.json`。

---

## Task 1: ドロワー用 CSS を `styles/theme.css` に追加

**Files:**
- Modify: `styles/theme.css`（`.appshell-drawer-logout` ブロック直後、`@media(max-width:480px)` の直前に挿入）

- [ ] **Step 1: CSS を追記する**

`styles/theme.css` の次の箇所（89〜97 行目付近）:

```css
.appshell-drawer a:hover,
.appshell-drawer button:hover{background:var(--bg2)}
.appshell-drawer-ico{width:1.4em;text-align:center;flex-shrink:0}
.appshell-drawer-logout{
  margin-top:auto;border-top:1px solid var(--line);color:var(--dim);
}

@media(max-width:480px){
```

を、次のように `.appshell-drawer-logout{...}` と空行の間へ3ルール挿入した状態にする:

```css
.appshell-drawer a:hover,
.appshell-drawer button:hover{background:var(--bg2)}
.appshell-drawer-ico{width:1.4em;text-align:center;flex-shrink:0}
.appshell-drawer-logout{
  margin-top:auto;border-top:1px solid var(--line);color:var(--dim);
}
.appshell-drawer-group{
  padding:14px 18px 4px;
  font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;
  color:var(--dim);
}
.appshell-drawer span[aria-current="page"]{
  display:flex;align-items:center;gap:12px;width:100%;
  padding:11px 18px;font-size:.92rem;
  color:var(--dim);cursor:default;
}
.scoreboard .appshell-hamburger{
  font-size:1.15rem;padding:2px 2px 2px 6px;
}

@media(max-width:480px){
```

- [ ] **Step 2: 目視で差分を確認する**

Run: `git diff styles/theme.css`
Expected: 追加が3ルール（`.appshell-drawer-group` / `.appshell-drawer span[aria-current="page"]` / `.scoreboard .appshell-hamburger`）のみ。既存行の変更・削除は無い。

- [ ] **Step 3: コミットする**

```bash
git add styles/theme.css
git commit -m "$(cat <<'EOF'
feat(quiz-nav): 模試ページ用ドロワーの見出し・表示中項目 CSS を追加

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KM28JJxt3JocdSahvonhec
EOF
)"
```

---

## Task 2: `js/quiz-nav.js` を新規作成する

**Files:**
- Create: `js/quiz-nav.js`

- [ ] **Step 1: ファイルを作成し、全文を書く**

`js/quiz-nav.js` を次の内容で作成する:

```js
// 模試ページ（quiz.html / quiz-engine.js）専用のナビゲーションドロワー。
// quiz-engine.js の initQuiz から window.quizNav.mount(data) で呼ばれる。
// 依存: window.APP_NAV（js/nav.js）。js/util.js には依存しない（esc を内蔵）。
// フル app-shell は使わない。見た目は styles/theme.css の .appshell-drawer 系を流用。
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 現在ページの ?d= の値（例: tests/2026-xxx/data.json）
  function currentD() {
    return new URLSearchParams(location.search).get('d') || '';
  }

  // /api/tests のエントリ path（/quiz.html?d=tests/xxx/data.json）から d= を取り出す
  function entryD(path) {
    var m = /[?&]d=([^&]+)/.exec(path || '');
    return m ? decodeURIComponent(m[1]) : '';
  }

  var drawer, backdrop, burger, onKeyRef;

  function openDrawer() {
    drawer.classList.add('open');
    backdrop.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    burger.setAttribute('aria-expanded', 'true');
    onKeyRef = function (e) { if (e.key === 'Escape') closeDrawer(); };
    document.addEventListener('keydown', onKeyRef);
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    burger.setAttribute('aria-expanded', 'false');
    if (onKeyRef) { document.removeEventListener('keydown', onKeyRef); onKeyRef = null; }
  }

  function toggleDrawer() {
    if (drawer.classList.contains('open')) closeDrawer(); else openDrawer();
  }

  function groupHtml(label, itemsHtml) {
    return '<div class="appshell-drawer-group">' + esc(label) + '</div>' + itemsHtml;
  }

  // グループ3: APP_NAV の分離ページ（adminOnly は除外）
  function menuHtml() {
    var nav = window.APP_NAV || [];
    return nav.filter(function (it) { return !it.adminOnly; }).map(function (it) {
      return '<a href="' + esc(it.href) + '">' +
        '<span class="appshell-drawer-ico">' + esc(it.icon || '') + '</span>' +
        esc(it.label || '') + '</a>';
    }).join('');
  }

  // グループ1+2: 同じ試験（year/grade/exam 完全一致）の模試
  function siblingsHtml(tests, data) {
    if (!data || data.year == null || data.grade == null || data.exam == null) return '';
    if (!Array.isArray(tests)) return '';

    var cd = currentD();
    var same = tests.filter(function (t) {
      return t.year === data.year && t.grade === data.grade && t.exam === data.exam;
    });
    var sameSubject = same.filter(function (t) { return t.subject === data.subject; });
    var otherSubject = same.filter(function (t) { return t.subject !== data.subject; });

    var html = '';

    // グループ1: 同じ試験・同じ科目。現在の模試はリンクにせず「（表示中）」。
    var g1 = sameSubject.map(function (t) {
      var label = t.title || t.subject || '';
      if (entryD(t.path) === cd) {
        return '<span aria-current="page">' + esc(label) + '（表示中）</span>';
      }
      return '<a href="' + esc(t.path) + '">' + esc(label) + '</a>';
    }).join('');
    if (g1) html += groupHtml('同じ試験・' + (data.subject || ''), g1);

    // グループ2: 同じ試験・他の科目
    if (otherSubject.length) {
      var g2 = otherSubject.map(function (t) {
        var label = (t.subject || '') + ' — ' + (t.title || t.subject || '');
        return '<a href="' + esc(t.path) + '">' + esc(label) + '</a>';
      }).join('');
      html += groupHtml('同じ試験・他の科目', g2);
    }

    return html;
  }

  function render(tests, data) {
    drawer.innerHTML = siblingsHtml(tests, data) + groupHtml('メニュー', menuHtml());
    var links = drawer.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', closeDrawer);
    }
  }

  function mount(data) {
    var bar = document.querySelector('.scoreboard .wrap');
    if (!bar || document.querySelector('.appshell-drawer')) return; // 採点バー未描画 / 二重 mount 防止

    burger = document.createElement('button');
    burger.className = 'appshell-hamburger';
    burger.type = 'button';
    burger.setAttribute('aria-label', 'メニュー');
    burger.setAttribute('aria-expanded', 'false');
    burger.textContent = '☰'; // ☰
    burger.addEventListener('click', toggleDrawer);
    bar.appendChild(burger);

    backdrop = document.createElement('div');
    backdrop.className = 'appshell-backdrop';
    backdrop.addEventListener('click', closeDrawer);
    document.body.appendChild(backdrop);

    drawer = document.createElement('nav');
    drawer.className = 'appshell-drawer';
    drawer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(drawer);

    // まずメニューだけで描画 → /api/tests が返ったら3グループに差し替え
    render(null, data);
    fetch('/api/tests')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (tests) { render(tests, data); })
      .catch(function () { /* メニューのみのまま。移動手段は確保される */ });
  }

  window.quizNav = { mount: mount };
})();
```

- [ ] **Step 2: 構文エラーが無いことを確認する**

Run: `node --check js/quiz-nav.js`
Expected: 出力なし（終了コード0）。エラーが出たら直す。

- [ ] **Step 3: コミットする**

```bash
git add js/quiz-nav.js
git commit -m "$(cat <<'EOF'
feat(quiz-nav): 模試ページ用ナビゲーションドロワー js/quiz-nav.js を追加

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KM28JJxt3JocdSahvonhec
EOF
)"
```

---

## Task 3: `js/quiz-engine.js` から読み込んで mount する

**Files:**
- Modify: `js/quiz-engine.js`（`initQuiz` 内、`window.QUIZ_SUBJECT = data.subject;` の直後 = 524 行目付近）

- [ ] **Step 1: 読み込み4行を追加する**

`js/quiz-engine.js` の次の箇所:

```js
  window.QUIZ_SUBJECT = data.subject;

  // Load external deps: supabase → points.js → progress.js
  addScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', function () {
```

を次のようにする（`window.QUIZ_SUBJECT = data.subject;` の直後にブロックを1つ挿入）:

```js
  window.QUIZ_SUBJECT = data.subject;

  // 模試ページ内ナビゲーション（採点バー右上のハンバーガー）
  addScript('/js/nav.js', function () {
    addScript('/js/quiz-nav.js', function () {
      if (window.quizNav) window.quizNav.mount(data);
    });
  });

  // Load external deps: supabase → points.js → progress.js
  addScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', function () {
```

（`addScript(src, onload)` は同ファイル 449 行目で定義済みのヘルパー。`data` は `initQuiz(data)` の引数でこのスコープに在る。）

- [ ] **Step 2: 構文エラーが無いことを確認する**

Run: `node --check js/quiz-engine.js`
Expected: 出力なし（終了コード0）。

- [ ] **Step 3: サーバーを起動する**

Run: `npm start`
Expected: `http://localhost:3000` で起動（`PORT` 未設定時）。別ターミナルで起動したままにする。

- [ ] **Step 4: 兄弟のある模試をブラウザで開いて基本動作を確認する**

`http://localhost:3000/api/tests` を開き、同じ `year`・`grade`・`exam` を持つエントリが2件以上ある組を探す。その1つの `path`（`/quiz.html?d=tests/xxx/data.json`）をブラウザで開く。

Expected:
- 上部スティッキー採点バーの右端に `☰` が出る。
- `☰` クリックでドロワーが右から出る。「同じ試験・{科目}」に自分を含む同科目の模試（自分は「（表示中）」でクリック不可）、他科目があれば「同じ試験・他の科目」、最後に「メニュー」（🏠ホーム〜👥メンバー、「管理」は無し）。
- 背景クリック / `Esc` で閉じる。リンクを踏むと該当ページへ遷移する。

- [ ] **Step 5: コミットする**

```bash
git add js/quiz-engine.js
git commit -m "$(cat <<'EOF'
feat(quiz-nav): quiz-engine から nav.js + quiz-nav.js を読み込み mount

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KM28JJxt3JocdSahvonhec
EOF
)"
```

---

## Task 4: エッジケースの手動検証

**Files:** なし（検証のみ。問題が出たら該当タスクのファイルを修正して追いコミット）

前提: `npm start` でサーバーが動いていること。

- [ ] **Step 1: その試験でその科目が1つだけの模試**

`http://localhost:3000/api/tests` で、同じ `year`/`grade`/`exam` を持つのが1件だけ（かつ他科目は在る）という組を探して開く。
Expected: 「同じ試験・{科目}」は「{title}（表示中）」の1行だけ。「同じ試験・他の科目」は他科目があれば表示。「メニュー」は常に表示。

- [ ] **Step 2: `exam` フィールド欠落**

`tests/` 配下のどれか1つの `data.json` を一時的にコピーして `exam` キーを消し、その `quiz.html?d=...` を開く（または DevTools の Network で `/api/tests` を Block してリロード）。
Expected: 「メニュー」だけ表示。JS エラーでドロワーが壊れない。確認後、`data.json` を元に戻す（`git checkout -- tests/...`）。

- [ ] **Step 3: `/api/tests` 失敗（オフライン相当）**

DevTools → Network → `/api/tests` を右クリックして "Block request URL" → リロードして `☰` を開く。
Expected: 「メニュー」だけ表示。コンソールに未処理例外が出ない。確認後 Block を解除。

- [ ] **Step 4: モバイル幅**

DevTools のデバイスツールバーで 375px 幅にして模試ページを開く。
Expected: 採点バーが崩れず `☰` が押せる（折り返しは可）。ドロワーは画面幅の 80vw（最大 280px）で右から出る。背景が薄暗くなる。

- [ ] **Step 5: 「表示中」項目の見た目**

Task 3 Step 4 で開いたページで再度ドロワーを開く。
Expected: 「（表示中）」の行は他のリンクと同じ左余白・行高で、色が薄め（`--dim`）でカーソルが変わらず、クリックしても何も起きない。

- [ ] **Step 6: 問題があれば修正して追いコミット**

いずれかの Step で不具合が出たら、原因のファイル（`js/quiz-nav.js` 等）を直し、`node --check` を通してから:

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix(quiz-nav): <直した内容>

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KM28JJxt3JocdSahvonhec
EOF
)"
```

- [ ] **Step 7: サーバーを止める**

`npm start` を動かしているターミナルで Ctrl+C。

---

## 完了条件

- 模試ページの採点バー右端に `☰` が出て、ドロワーから「同じ試験・同科目 → 同じ試験・他科目 → メニュー」の順にリンクが並ぶ。
- 同じ試験の他模試・他科目模試・分離ページに1クリックで飛べる。現在の模試は「（表示中）」でリンクにならない。
- `exam` 欠落・`/api/tests` 失敗でもメニューだけは出て、JS エラーにならない。
- 既存のヘッダー・採点バー・問題描画・左下「← トップへ」ピルの見た目が変わっていない。
- `git status` がクリーン（Task 2 Step 2 の一時 data.json 変更などが残っていない）。
