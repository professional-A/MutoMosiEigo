# フェーズ1：共有基盤（theme.css / api.js / app-shell.js）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** テーマ変数・認証fetch・共通ヘッダー（ハンバーガーメニュー）を独立ファイルに切り出し、`index.html` をそれに載せ替える。既存機能の見た目・挙動は変えない。

**Architecture:** ビルドなしのバニラ構成。`styles/theme.css`（`<link>` で読む）＋ `js/api.js`（`window.api`、P1 では配置のみ）＋ `js/app-shell.js`（`window.appShell`、ヘッダーバーとドロワーを描画するダムなビュー）。`index.html` は認証状態の管理を従来どおり `updateAuthBar()` に残し、そこから `appShell.update()` を呼ぶ。`#header-stack` / `syncLayout()` / `ticker` / `notif-panel` / 全モーダルには触らない。

**Tech Stack:** Node.js + Express（`express.static('.')`）、バニラ JS（ES5相当＋async/await）、Supabase JS CDN。テスト/リントツールなし。

**参照スペック:** `docs/superpowers/specs/2026-09-10-architecture-refactor-design.md`（「フェーズ1 詳細設計」節）

---

## 前提・環境メモ

- `npm start` は DB 環境変数（`DATABASE_URL` / `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`）が無いと起動しない（`initDB()` 失敗で `process.exit(1)`）。
- **本計画の検証はリポジトリルートで静的サーバーを立てて行う:** `python3 -m http.server 8000` → ブラウザで `http://localhost:8000/`。
  - `index.html` の `fetch('tests.json')` は静的配信で成功。`fetch('/api/...')` は 404 になるが既存コードは `.catch` 済みで、未ログインUIが表示される（＝P1の主要な検証対象）。
  - ログイン・モーダルを跨ぐ完全な確認は Render デプロイ後に別途チェックリストで行う（Task 5 末尾）。
- 変更対象は 4 ファイルのみ: 新規 `styles/theme.css` `js/api.js` `js/app-shell.js`、変更 `index.html`。`server.js` は触らない。

## File Structure

| ファイル | 責務 |
|----------|------|
| `styles/theme.css`（新規） | テーマCSS変数の唯一の定義（`index.html` 現状値）＋ reset 2行 ＋ `data-theme` 別テーマ3ブロック ＋ app-shell 用スタイル。他ページは P2/P3 で読み込む |
| `js/api.js`（新規） | `window.api = { get, post, put, del }`。認証トークン（`muto_session` 優先 → Supabase）を付けた fetch ラッパ。2xx 以外は `Error`（`.status` / `.body`）。**P1 では配置のみ・呼び出し元なし** |
| `js/app-shell.js`（新規） | `window.appShell = { mount(el, opts), update(state), setBadge(n) }`。ヘッダーバー＋ドロワーの描画のみ。fetch しない。認証状態は呼び出し側が `update()` で渡す |
| `index.html`（変更） | `<link>` 追加、inline `<style>` から `:root`＋reset＋テーマ3ブロックを削除、`auth-bar` マークアップを `#app-shell-bar` に置換、`app-shell.js`/`api.js` の `<script>` 追加、`updateAuthBar()` を `appShell.update()` 呼び出しに簡約、初期化で `appShell.mount()` を1回実行 |

---

## Task 1: `styles/theme.css` を作成

**Files:**
- Create: `styles/theme.css`

- [ ] **Step 1: ファイルを作成**

`styles/theme.css`:

```css
/* 武藤模試 共通テーマ・共通シェル
   テーマCSS変数の唯一の定義。全ページが <link rel="stylesheet" href="/styles/theme.css"> で読む。
   （フェーズ1では index.html のみ。フェーズ2/3で quiz / 各機能ページも移行）
   値は index.html の現状 :root をそのまま踏襲（quiz-engine.js とは微差あり。統一はフェーズ2）。 */

:root{
  --bg:#0a1626; --bg2:#0e1d33; --card:#15263f; --card2:#0e1d33;
  --line:#27406a; --ink:#e7eef7; --muted:#8aa1c0; --dim:#5f7c9c; --fg:#e7eef7;
  --teal:#46d6c4; --amber:#f6b352; --rose:#f0716e;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}

/* テーマプリセット（applyTheme が <html data-theme="..."> を切り替える。navy は無属性） */
[data-theme="purple"]{--bg:#0d0a1f;--bg2:#131028;--card:#1e1840;--card2:#131028;--line:#362e60;--ink:#e8e4ff;--fg:#e8e4ff;--muted:#9b8fc0;--dim:#6b5e9c}
[data-theme="forest"]{--bg:#08100f;--bg2:#0d1a18;--card:#102820;--card2:#0d1a18;--line:#1a3830;--ink:#d4ede8;--fg:#d4ede8;--muted:#7aaba0;--dim:#4d7870}
[data-theme="charcoal"]{--bg:#0f0f0f;--bg2:#1a1a1a;--card:#242424;--card2:#1a1a1a;--line:#3a3a3a;--ink:#f0f0f0;--fg:#f0f0f0;--muted:#999;--dim:#666}

/* ══ 共通シェル（app-shell.js が描画）══════════════════════════ */

/* ヘッダーバー（index.html の旧 .auth-bar の見た目を踏襲） */
.appshell-bar{
  display:flex;align-items:center;gap:8px;
  padding:6px 10px;
  background:rgba(10,22,38,.92);backdrop-filter:blur(8px);
  border-bottom:1px solid var(--line);
  font-size:.82rem;
  font-family:"Outfit","Noto Sans JP",sans-serif;
}
.appshell-brand{
  font-family:"Fraunces",serif;font-weight:600;font-size:1.02rem;
  color:var(--teal);text-decoration:none;flex-shrink:0;
}
.appshell-spacer{flex:1}
.appshell-btn{
  font-family:inherit;font-size:.8rem;white-space:nowrap;flex-shrink:0;
  padding:4px 14px;border-radius:99px;
  border:1px solid var(--line);background:var(--card);color:var(--muted);
  cursor:pointer;transition:.15s;
}
.appshell-btn:hover{border-color:var(--teal);color:var(--teal)}
.appshell-btn.primary{background:var(--teal);border-color:var(--teal);color:#0a1626;font-weight:600}
.appshell-name{display:flex;align-items:center;gap:6px;font-size:.85rem;color:var(--muted);flex-shrink:0}
.appshell-name b{color:var(--teal);font-weight:700}
.appshell-icon{
  background:none;border:none;cursor:pointer;font-size:1.1rem;line-height:1;
  color:var(--ink);position:relative;padding:2px 4px;flex-shrink:0;
}
.appshell-hamburger{
  background:none;border:none;cursor:pointer;flex-shrink:0;
  font-size:1.35rem;line-height:1;color:var(--ink);padding:2px 4px;
}

/* ドロワー */
.appshell-backdrop{
  position:fixed;inset:0;background:rgba(0,0,0,.5);
  opacity:0;pointer-events:none;transition:opacity .2s;z-index:250;
}
.appshell-backdrop.open{opacity:1;pointer-events:auto}
.appshell-drawer{
  position:fixed;top:0;right:0;bottom:0;width:min(280px,80vw);
  background:var(--card);border-left:1px solid var(--line);
  transform:translateX(100%);transition:transform .2s ease;
  z-index:251;display:flex;flex-direction:column;
  padding:14px 0;overflow-y:auto;
  font-family:"Outfit","Noto Sans JP",sans-serif;
}
.appshell-drawer.open{transform:translateX(0)}
.appshell-drawer-head{
  padding:6px 18px 14px;margin-bottom:6px;
  border-bottom:1px solid var(--line);
  font-size:.8rem;color:var(--dim);
}
.appshell-drawer a,
.appshell-drawer button{
  display:flex;align-items:center;gap:12px;width:100%;
  padding:11px 18px;
  font-family:inherit;font-size:.92rem;text-align:left;
  color:var(--ink);text-decoration:none;
  background:none;border:none;cursor:pointer;transition:.12s;
}
.appshell-drawer a:hover,
.appshell-drawer button:hover{background:var(--bg2)}
.appshell-drawer-ico{width:1.4em;text-align:center;flex-shrink:0}
.appshell-drawer-logout{
  margin-top:auto;border-top:1px solid var(--line);color:var(--dim);
}

@media(max-width:480px){
  .appshell-bar{padding:5px 8px;gap:6px;font-size:.75rem}
  .appshell-brand{font-size:.92rem}
  .appshell-btn{font-size:.72rem;padding:3px 10px}
}
```

- [ ] **Step 2: 静的配信されることを確認**

Run:
```bash
python3 -m http.server 8000 >/dev/null 2>&1 & echo $! > /tmp/p1srv.pid
sleep 1
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:8000/styles/theme.css
kill $(cat /tmp/p1srv.pid)
```
Expected: `200 text/css` （content_type は環境により `text/css` を含む文字列。200 であれば可）

- [ ] **Step 3: Commit**

```bash
git add styles/theme.css
git commit -m "feat(shell): テーマ変数と共通シェルCSSを styles/theme.css に集約

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016ad3DsBBiHixufjZCNPv8V"
```

---

## Task 2: `js/api.js` を作成

**Files:**
- Create: `js/api.js`

- [ ] **Step 1: ファイルを作成**

`js/api.js`:

```js
// 認証付き fetch の共通ラッパ。window.api を生やす。
// トークン規則は js/points.js / js/progress.js の getToken() と同一
// （localStorage.muto_session 優先 → 無ければ Supabase セッション）。
// ヘッダーは Authorization: <token>（"Bearer " プレフィックスは付けない。既存APIに合わせる）。
// フェーズ1では配置のみ。呼び出し元はフェーズ2以降で移行する。
(function () {
  var SUPABASE_URL      = 'https://gwknnqceiozbmxrqjcae.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_4MgSWSr8bbuUf5Vp_LSD6Q_SI-ciZ2B';
  var _token = null;

  async function getToken() {
    if (_token) return _token;
    var custom = localStorage.getItem('muto_session');
    if (custom) { _token = custom; return _token; }
    try {
      if (!window.supabase) return null;
      var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      var r = await client.auth.getSession();
      _token = (r.data && r.data.session && r.data.session.access_token) || null;
    } catch (e) { /* 未ログイン扱い */ }
    return _token;
  }

  async function request(method, path, body) {
    var headers = {};
    var token = await getToken();
    if (token) headers['Authorization'] = token;
    var init = { method: method, headers: headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    var res  = await fetch(path, init);
    var text = await res.text();
    var data = null;
    if (text) { try { data = JSON.parse(text); } catch (e) { data = text; } }
    if (!res.ok) {
      var err = new Error('HTTP ' + res.status + ' ' + method + ' ' + path);
      err.status = res.status;
      err.body   = data;
      throw err;
    }
    return data;
  }

  window.api = {
    get:  function (p)    { return request('GET', p); },
    post: function (p, b) { return request('POST', p, b === undefined ? {} : b); },
    put:  function (p, b) { return request('PUT', p, b === undefined ? {} : b); },
    del:  function (p)    { return request('DELETE', p); },
    _resetToken: function () { _token = null; }
  };
})();
```

- [ ] **Step 2: 構文チェック**

Run: `node --check js/api.js`
Expected: 出力なし・終了コード 0

- [ ] **Step 3: Commit**

```bash
git add js/api.js
git commit -m "feat(shell): 認証付き fetch ラッパ js/api.js を追加（配置のみ）

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016ad3DsBBiHixufjZCNPv8V"
```

---

## Task 3: `js/app-shell.js` を作成

**Files:**
- Create: `js/app-shell.js`

**設計:** ダムなビュー。`mount(el, opts)` でヘッダーバーを `el` に描画し、ドロワーとバックドロップを `<body>` 直下に追加。`update(state)` で表示状態を切り替えるだけ。fetch しない。
- ベルボタンは既存コード互換のため `class="notif-btn appshell-icon"` かつ内側に `<span class="notif-badge" id="notif-badge">` を持つ（`index.html` の行 2665 / 4015 / 4022 / 4027 がこの id / class を参照）。
- アバターは `<div class="avatar" id="auth-avatar">`（`index.html` 行 2341 の `applyFrame` 対象。`frame-*` CSS は index.html に残る）。
- `nav` 項目に `id` を指定できる。レース項目に `id:'race-view-btn'` を付け、既存 `loadRaceSection()`（行 3538、null ガード済み）がその行の表示/非表示をアクティブなレースの有無で制御する。

- [ ] **Step 1: ファイルを作成**

`js/app-shell.js`:

```js
// 武藤模試 共通シェル（ヘッダーバー＋ハンバーガードロワー）
// ダムなビュー。認証状態は各ページ側が保持し update() で流し込む。fetch はしない。
//
// 使い方:
//   appShell.mount(document.getElementById('app-shell-bar'), {
//     nav: [{ key, icon, label, href?, onClick?, id?, adminOnly? }],
//     onGoogleLogin, onIdLogin, onLogout, onNotif, onAvatar   // すべて既存関数を渡す
//   });
//   appShell.update({ loggedIn, name, points, avatar, frame, isAdmin });
//
// nav 項目の描画規則:
//   - href があり onClick が無ければ <a href>（通常遷移）
//   - それ以外は <button>（クリックで onClick を呼び、ドロワーを閉じる）
//   - key !== 'home' && key !== 'race' の項目は [data-auth] 付き（未ログイン時に隠す）
//   - adminOnly の項目は [data-admin] 付き（管理者以外は隠す）
(function () {
  var opts = null;
  var els = {};
  var drawer = null, backdrop = null;

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class')      el.className = attrs[k];
      else if (k === 'text')  el.textContent = attrs[k];
      else if (k === 'html')  el.innerHTML = attrs[k];
      else                    el.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  function buildBar(host) {
    host.className = 'appshell-bar';
    host.innerHTML = '';

    var brand  = h('a',   { 'class': 'appshell-brand', href: '/', text: '武藤模試' });
    var spacer = h('span', { 'class': 'appshell-spacer' });

    var idBtn = h('button', { 'class': 'appshell-btn', type: 'button', text: 'IDでログイン' });
    idBtn.addEventListener('click', function () { opts.onIdLogin && opts.onIdLogin(); });

    var googleBtn = h('button', { 'class': 'appshell-btn primary', type: 'button', text: 'Googleでログイン' });
    googleBtn.addEventListener('click', function () { opts.onGoogleLogin && opts.onGoogleLogin(); });

    var notifBtn = h('button', { 'class': 'notif-btn appshell-icon', type: 'button', title: 'お知らせ' });
    notifBtn.innerHTML = '🔔<span class="notif-badge" id="notif-badge">2</span>';
    notifBtn.addEventListener('click', function () { opts.onNotif && opts.onNotif(); });

    var avatar = h('div', { 'class': 'avatar', id: 'auth-avatar', title: 'アイコン変更', text: '🐸' });
    avatar.addEventListener('click', function () { opts.onAvatar && opts.onAvatar(); });
    var nameB   = h('b',    { 'data-role': 'name' });
    var pointsS = h('span', { 'data-role': 'points' });
    var nameWrap = h('span', { 'class': 'appshell-name' }, [avatar, nameB, pointsS]);

    var burger = h('button', {
      'class': 'appshell-hamburger', type: 'button',
      'aria-label': 'メニュー', 'aria-expanded': 'false', text: '☰'
    });
    burger.addEventListener('click', toggleDrawer);

    [brand, spacer, idBtn, googleBtn, notifBtn, nameWrap, burger].forEach(function (n) { host.appendChild(n); });

    els = {
      idBtn: idBtn, googleBtn: googleBtn, notifBtn: notifBtn,
      nameWrap: nameWrap, avatar: avatar, nameB: nameB, pointsS: pointsS, burger: burger
    };
  }

  function buildDrawer() {
    backdrop = h('div', { 'class': 'appshell-backdrop' });
    backdrop.addEventListener('click', closeDrawer);

    drawer = h('nav', { 'class': 'appshell-drawer', 'aria-hidden': 'true' });

    var head = h('div', { 'class': 'appshell-drawer-head', 'data-role': 'drawer-head' });
    drawer.appendChild(head);
    els.drawerHead = head;

    (opts.nav || []).forEach(function (item) {
      var inner = [
        h('span', { 'class': 'appshell-drawer-ico', text: item.icon || '' }),
        item.label || ''
      ];
      var node;
      if (item.href && !item.onClick) {
        node = h('a', { href: item.href }, inner);
        node.addEventListener('click', function () { closeDrawer(); });
      } else {
        node = h('button', { type: 'button' }, inner);
        node.addEventListener('click', function () {
          closeDrawer();
          if (item.onClick) item.onClick();
        });
      }
      if (item.id) node.id = item.id;
      if (item.adminOnly) node.setAttribute('data-admin', '1');
      if (item.key !== 'home' && item.key !== 'race') node.setAttribute('data-auth', '1');
      drawer.appendChild(node);
    });

    var logout = h('button', {
      'class': 'appshell-drawer-logout', type: 'button', 'data-role': 'logout', text: 'ログアウト'
    });
    logout.addEventListener('click', function () {
      closeDrawer();
      if (opts.onLogout) opts.onLogout();
    });
    drawer.appendChild(logout);
    els.logout = logout;

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
  }

  function openDrawer() {
    drawer.classList.add('open');
    backdrop.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    els.burger.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', onKey);
    var first = drawer.querySelector('a:not([hidden]),button:not([hidden])');
    if (first) first.focus();
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    els.burger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKey);
  }
  function toggleDrawer() {
    if (drawer.classList.contains('open')) closeDrawer(); else openDrawer();
  }
  function onKey(e) { if (e.key === 'Escape') closeDrawer(); }

  window.appShell = {
    mount: function (host, options) {
      if (!host) { console.warn('[app-shell] mount: host element not found'); return; }
      opts = options || {};
      buildBar(host);
      buildDrawer();
      this.update({ loggedIn: false });
    },
    update: function (state) {
      state = state || {};
      var on = !!state.loggedIn;
      var ptsStr = (state.points != null ? Number(state.points).toLocaleString() : '0') + 'pt';

      els.idBtn.hidden     = on;
      els.googleBtn.hidden = on;
      els.notifBtn.hidden  = !on;
      els.nameWrap.hidden  = !on;
      els.logout.hidden    = !on;
      els.drawerHead.hidden = !on;

      els.nameB.textContent   = state.name || '';
      els.pointsS.textContent = ptsStr;
      if (state.avatar) els.avatar.textContent = state.avatar;
      els.avatar.className = 'avatar frame-' + (state.frame || 'default');
      els.drawerHead.textContent =
        (state.avatar || '🐸') + ' ' + (state.name || '') + ' ・ ' + ptsStr;

      drawer.querySelectorAll('[data-auth]').forEach(function (n) { n.hidden = !on; });
      drawer.querySelectorAll('[data-admin]').forEach(function (n) { n.hidden = !(on && state.isAdmin); });
    },
    setBadge: function (n) {
      var b = document.getElementById('notif-badge');
      if (b) b.textContent = n;
    }
  };
})();
```

- [ ] **Step 2: 構文チェック**

Run: `node --check js/app-shell.js`
Expected: 出力なし・終了コード 0

- [ ] **Step 3: Commit**

```bash
git add js/app-shell.js
git commit -m "feat(shell): 共通ヘッダー＋ハンバーガードロワー js/app-shell.js を追加

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016ad3DsBBiHixufjZCNPv8V"
```

---

## Task 4: `index.html` の CSS を `theme.css` に載せ替え

**Files:**
- Modify: `index.html`（`<head>` 内、行 10〜22 付近）

この Task の後も `index.html` はまだ旧 `auth-bar` を持ち、単体で完全に動作する（CSS の出所が変わるだけ）。

- [ ] **Step 1: `<link>` を追加し、inline のテーマ定義を削除**

`index.html` の以下を置換する。

old（行 10〜22）:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<style>
:root{
  --bg:#0a1626; --bg2:#0e1d33; --card:#15263f; --card2:#0e1d33;
  --line:#27406a; --ink:#e7eef7; --muted:#8aa1c0; --dim:#5f7c9c; --fg:#e7eef7;
  --teal:#46d6c4; --amber:#f6b352; --rose:#f0716e;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
/* テーマプリセット */
[data-theme="purple"]{--bg:#0d0a1f;--bg2:#131028;--card:#1e1840;--card2:#131028;--line:#362e60;--ink:#e8e4ff;--fg:#e8e4ff;--muted:#9b8fc0;--dim:#6b5e9c}
[data-theme="forest"]{--bg:#08100f;--bg2:#0d1a18;--card:#102820;--card2:#0d1a18;--line:#1a3830;--ink:#d4ede8;--fg:#d4ede8;--muted:#7aaba0;--dim:#4d7870}
[data-theme="charcoal"]{--bg:#0f0f0f;--bg2:#1a1a1a;--card:#242424;--card2:#1a1a1a;--line:#3a3a3a;--ink:#f0f0f0;--fg:#f0f0f0;--muted:#999;--dim:#666}
```

new:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<link rel="stylesheet" href="/styles/theme.css">
<style>
```

（＝ `<link>` を1行追加し、`:root{…}` から `[data-theme="charcoal"]{…}` までの11行を丸ごと削除。直後の行は `body{` になる。）

- [ ] **Step 2: 見た目が変わっていないことを確認**

Run:
```bash
python3 -m http.server 8000 >/dev/null 2>&1 & echo $! > /tmp/p1srv.pid ; sleep 1
```
ブラウザで `http://localhost:8000/` を開き、確認:
- 背景・カード・文字色・テールのアクセント色が従来どおり（濃紺テーマ）。真っ白／無スタイルになっていない。
- 模試フォルダのカード一覧が表示される（`tests.json` は静的配信で読める）。
- DevTools Console にエラーが出ていない（`/api/*` の 404 は想定内で、コードが握りつぶす）。
- DevTools Elements で `<html>` に `data-theme` 属性が無い（navy）こと、`<head>` に `theme.css` の `<link>` があること。

確認後: `kill $(cat /tmp/p1srv.pid)`

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "refactor(index): テーマCSS変数を theme.css の <link> に置き換え

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016ad3DsBBiHixufjZCNPv8V"
```

---

## Task 5: `index.html` のヘッダーを app-shell に載せ替え

**Files:**
- Modify: `index.html`（行 464〜481 の `auth-bar`、`<script>` 追加、`updateAuthBar()` 行 1828〜1870、直後に `mount` 呼び出し）

4つの編集を1コミットで行う（途中状態では `index.html` が壊れるため）。

- [ ] **Step 1: 旧 `auth-bar` マークアップを `#app-shell-bar` に置換**

old（行 464〜481。`<div class="auth-bar" id="auth-bar">` から対応する `</div>` まで）:
```html
<div class="auth-bar" id="auth-bar">
  <div class="auth-bar-left">
    <button class="notif-btn" onclick="toggleNotif()" title="お知らせ">
      🔔<span class="notif-badge" id="notif-badge">2</span>
    </button>
  </div>
  <span id="auth-status">ログインしていません</span>
  <button class="auth-btn" id="admin-btn" style="display:none" onclick="openAdminModal()">管理</button>
  <button class="auth-btn" id="members-btn" style="display:none" onclick="openMembersModal()">メンバー</button>
  <button class="auth-btn" id="scores-btn" style="display:none" onclick="openScoresModal()">📊成績</button>
  <button class="auth-btn" id="battle-btn" style="display:none" onclick="openBattleModal()">⚔️バトル</button>
  <button class="auth-btn" id="clrank-btn" style="display:none" onclick="openClrankPage()">🏆順位</button>
  <button class="auth-btn" id="race-view-btn" style="display:none" onclick="openRaceView()">🏁レース</button>
  <div class="avatar" id="auth-avatar" style="display:none" onclick="openAvatarModal()" title="アイコン変更">🐸</div>
  <button class="auth-btn" id="test-btn" style="display:none" onclick="openTestModal()">📋テスト</button>
  <button class="auth-btn" id="pw-open-btn" onclick="openLoginModal()">IDでログイン</button>
  <button class="auth-btn primary" id="auth-open-btn" onclick="loginWithGoogle()">Googleでログイン</button>
</div>
```

new:
```html
<div id="app-shell-bar"></div>
```

（`#header-stack` の開始タグ、直後の `<div class="ticker-wrap" ...>`、`#header-stack` の閉じタグはそのまま残す。）

- [ ] **Step 2: `<script>` を追加**

`index.html` の主スクリプト第2ブロック（`grep -n '^<script>' index.html` で 2番目、行 1740 付近）の直前に2行追加する。

old:
```html
<script>
// ── 絵文字アイコン一覧 ──────────────────────────────────
const AVATAR_NAMES = { '😼':'ひろと', '😏':'考え方やな' };
```

new:
```html
<script src="/js/api.js"></script>
<script src="/js/app-shell.js"></script>
<script>
// ── 絵文字アイコン一覧 ──────────────────────────────────
const AVATAR_NAMES = { '😼':'ひろと', '😏':'考え方やな' };
```

- [ ] **Step 3: `updateAuthBar()` を `appShell.update()` 呼び出しに簡約**

old（行 1828〜1870、`function updateAuthBar() {` から対応する `}` まで丸ごと）:
```js
function updateAuthBar() {
  const bar   = document.getElementById('auth-status');
  const btn   = document.getElementById('auth-open-btn');
  const pwBtn = document.getElementById('pw-open-btn');
  const avEl  = document.getElementById('auth-avatar');
  if (authToken) {
    bar.innerHTML = `<strong>${esc(tu(authUser))}</strong> <span style="color:var(--teal);font-size:.85rem">${authPoints.toLocaleString()}pt</span>`;
    avEl.textContent = authAvatar;
    avEl.style.display = 'inline-flex';
    applyFrame(avEl, authFrame);
    btn.textContent = 'ログアウト';
    btn.classList.remove('primary');
    btn.onclick = doLogout;
    pwBtn.style.display = 'none';
    document.getElementById('test-btn').style.display = 'inline-block';
    document.getElementById('admin-btn').style.display = authEmail === 'kabu6113450@gmail.com' ? 'inline-block' : 'none';
    document.getElementById('members-btn').style.display = 'inline-block';
    document.getElementById('scores-btn').style.display = 'inline-block';
    document.getElementById('clrank-btn').style.display = 'inline-block';
    document.getElementById('battle-btn').style.display = 'inline-block';
    document.getElementById('notif-post-section').style.display = 'block';
    loadRanking();
    loadBanners();
    loadRaceSection();
  } else {
    bar.textContent = 'ログインしていません';
    avEl.style.display = 'none';
    loadRaceSection();
    btn.textContent = 'Googleでログイン';
    btn.classList.add('primary');
    btn.onclick = loginWithGoogle;
    pwBtn.style.display = 'inline-block';
    document.getElementById('test-btn').style.display = 'none';
    document.getElementById('admin-btn').style.display = 'none';
    document.getElementById('members-btn').style.display = 'none';
    document.getElementById('scores-btn').style.display = 'none';
    document.getElementById('clrank-btn').style.display = 'none';
    document.getElementById('battle-btn').style.display = 'none';
    document.getElementById('notif-post-section').style.display = 'none';
    loadBanners();
  }
  requestAnimationFrame(syncLayout);
}
```

new:
```js
function updateAuthBar() {
  appShell.update({
    loggedIn: !!authToken,
    name:     tu(authUser),
    points:   authPoints,
    avatar:   authAvatar,
    frame:    authFrame,
    isAdmin:  authEmail === 'kabu6113450@gmail.com'
  });
  if (authToken) {
    document.getElementById('notif-post-section').style.display = 'block';
    loadRanking();
    loadBanners();
    loadRaceSection();
  } else {
    document.getElementById('notif-post-section').style.display = 'none';
    loadRaceSection();
    loadBanners();
  }
  requestAnimationFrame(syncLayout);
}
```

（`esc` は不要になった＝app-shell は `textContent` で名前を入れる。`applyFrame` 相当は app-shell が `state.frame` から行う。行 2341 の `openAvatarModal` 保存処理側の `applyFrame` 呼び出しは残るが、`#auth-avatar` は app-shell が描画したものが存在するので動作する。）

- [ ] **Step 4: 初期化で `appShell.mount()` を1回だけ呼ぶ**

`updateAuthBar()` の直後（Step 3 で置換した関数の閉じ `}` の次行、`function syncLayout() {` の前）に挿入する。

old:
```js
  requestAnimationFrame(syncLayout);
}

function syncLayout() {
```

new:
```js
  requestAnimationFrame(syncLayout);
}

appShell.mount(document.getElementById('app-shell-bar'), {
  nav: [
    { key: 'home',    icon: '🏠', label: 'ホーム',       href: '/' },
    { key: 'test',    icon: '📋', label: 'テスト予測',   onClick: openTestModal },
    { key: 'scores',  icon: '📊', label: '成績',         onClick: openScoresModal },
    { key: 'clrank',  icon: '🏆', label: 'クラス順位',   onClick: openClrankPage },
    { key: 'battle',  icon: '⚔️', label: 'バトル',       onClick: openBattleModal },
    { key: 'race',    icon: '🏁', label: 'レース',       onClick: openRaceView, id: 'race-view-btn' },
    { key: 'members', icon: '👥', label: 'メンバー',     onClick: openMembersModal },
    { key: 'admin',   icon: '🛠', label: '管理',         onClick: openAdminModal, adminOnly: true }
  ],
  onGoogleLogin: loginWithGoogle,
  onIdLogin:     openLoginModal,
  onLogout:      doLogout,
  onNotif:       toggleNotif,
  onAvatar:      openAvatarModal
});

function syncLayout() {
```

（`openTestModal` などはすべて同じスクリプトブロック内の関数宣言でホイストされるため、この位置から参照して問題ない。`appShell` は先に読み込まれた `app-shell.js` のグローバル。`#app-shell-bar` は DOM 上この `<script>` より前にあるため取得できる。）

- [ ] **Step 5: 静的サーバーで構造・見た目・ドロワー操作を確認**

Run:
```bash
python3 -m http.server 8000 >/dev/null 2>&1 & echo $! > /tmp/p1srv.pid ; sleep 1
```
ブラウザ `http://localhost:8000/` で（未ログイン状態）。まず DevTools Console を開いたまま読み込み、`SyntaxError` が無いこと（インラインスクリプトの構文崩れ検知）を最初に確認する。続けて:
- ヘッダー左に「武藤模試」、右に `[IDでログイン]` `[Googleでログイン]` と `☰`。旧12ボタンの横並びが無い。
- `☰` クリックでドロワーが右から出る。バックドロップが出る。中身は「🏠 ホーム」のみ（他項目とログアウトは非表示）。
- バックドロップのクリック / `Esc` キーでドロワーが閉じる。
- 「🏠 ホーム」をクリック → `/` に遷移（同じページが再読込）。
- Console にエラーが無い（`ReferenceError` / `TypeError: ... null` が出ていないこと。特に `notif-badge` / `auth-avatar` 関連）。
- 背景色・テーマが Task 4 と変わっていない。
- ページ本体（模試フォルダ、時間割など）が従来どおり表示され、`body` の上部padding（`syncLayout`）でヘッダーに隠れていない。

確認後: `kill $(cat /tmp/p1srv.pid)`

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "refactor(index): ヘッダーを app-shell（共通ヘッダー＋ハンバーガー）に載せ替え

12個の常時ボタンをドロワーに集約。updateAuthBar() は appShell.update()
呼び出しに簡約。#header-stack / syncLayout / notif-panel / 各モーダルは不変更。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016ad3DsBBiHixufjZCNPv8V"
```

- [ ] **Step 7: Render デプロイ後チェックリスト（認証が絡むため本番でのみ確認可能）**

デプロイ後、`https://mutomosieigo.onrender.com/` で:
- 未ログイン: ヘッダーに `[IDでログイン][Googleでログイン][☰]`。ドロワーは「ホーム」のみ。
- `[IDでログイン]` → ログインモーダルが開く。ログイン成功 → ヘッダーが `🔔` + `🐸名前` + `☰` に変わる。
- `[Googleでログイン]` → Google OAuth。成功後、同上。
- ログイン中の `☰`: 先頭に `🐸 名前 ・ N pt`、項目「ホーム / テスト予測 / 成績 / クラス順位 / バトル / メンバー」＋（アクティブなレースがあれば）「レース」＋（管理者メールのみ）「管理」＋「ログアウト」。
- 各項目クリック → ドロワーが閉じ、対応する既存モーダル／オーバーレイが開く（テスト予測・成績・クラス順位・バトル・レース・メンバー・管理）。
- `🔔` → お知らせパネル開閉。既読でバッジ非表示。パネル外クリックで閉じる。
- `🐸`（アバター）→ アバター変更モーダル。保存するとヘッダーのアバターが変わる。
- 「ログアウト」→ 未ログイン表示に戻る。
- 管理モーダル内のテーマ切替（ネイビー / パープル / フォレスト / チャコール）が効き、リロード後も保持される。
- スマホ幅（〜400px）でヘッダーが崩れない。ドロワーが画面幅の 80%（最大280px）で出る。

問題があれば当該 Step に戻って修正し、再コミット。

---

## Self-Review

**1. Spec coverage（スペック「フェーズ1 詳細設計」との対応）:**
- `styles/theme.css`（テーマ変数＝index現状値／reset 2行／data-theme 3ブロック／app-shell スタイル、共通プリミティブは据え置き）→ Task 1 ✅
- `js/api.js`（`window.api` get/post/put/del、muto_session 優先トークン、Bearer なし、2xx 以外で throw、配置のみ）→ Task 2 ✅
- `js/app-shell.js`（`mount/update/setBadge`、ダムなビュー、ドロワー、Esc / バックドロップ / aria-expanded / 初期フォーカス、nav の href/onClick 分岐、adminOnly、fetch しない）→ Task 3 ✅
- `index.html` 変更 1〜8（`<link>` 追加／inline テーマ削除／`#app-shell-bar` 置換／`<script>` 追加／`updateAuthBar` 簡約／`mount` 呼び出し／`loadTheme` 不変更）→ Task 4・Task 5 ✅
- データフロー（theme.css → app-shell.js → api.js → mount → 認証復元 → updateAuthBar → update()＋loadRanking 等 → syncLayout）→ Task 5 Step 2・4 の並びで担保 ✅
- 「やらない」（モーダル分離／tests.json／エンジン／server.js／167関数の api.js 化）→ どの Task でも触れていない ✅
- スペック検証チェックリスト → Task 5 Step 5（静的）＋ Step 7（Render）に反映 ✅

**2. Placeholder scan:** "TBD" / "後で実装" / 抽象的な「適切に処理」なし。全 Step にコード or 具体コマンドあり。

**3. Type consistency:**
- `appShell.mount(host, opts)` / `appShell.update(state)` / `appShell.setBadge(n)` — Task 3 の定義と Task 5 の呼び出しでシグネチャ一致。
- `state` のキー `{ loggedIn, name, points, avatar, frame, isAdmin }` — Task 3 `update` の参照と Task 5 の呼び出しで一致。
- `nav` 項目のキー `{ key, icon, label, href, onClick, id, adminOnly }` — Task 3 `buildDrawer` の参照と Task 5 の配列で一致。
- `opts` のハンドラ名 `onGoogleLogin / onIdLogin / onLogout / onNotif / onAvatar` — Task 3 `buildBar`/`buildDrawer` と Task 5 の呼び出しで一致。
- `#notif-badge` / `#auth-avatar` / `.notif-btn` — app-shell が描画する id / class と、`index.html` 既存コード（行 2341 / 2665 / 4015 / 4022 / 4027）の参照で一致。
- `#race-view-btn` — Task 5 nav の `id` と既存 `loadRaceSection()`（行 3538）の参照で一致。

## Execution Handoff

実行方式は本計画を渡す時に選択する（subagent-driven 推奨 / inline execution）。
