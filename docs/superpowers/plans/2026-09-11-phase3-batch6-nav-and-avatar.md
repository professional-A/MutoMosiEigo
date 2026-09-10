# フェーズ3 バッチ6 — index.html ナビの href 化 ＋ アバターピッカーを app-shell へ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
1. `index.html` のハンバーガーメニューを、モーダルを開く `onClick` から独立ページへの実 `href`（`window.APP_NAV`）に切り替える。ホームから新しい独立ページ（`/scores.html` 等）へ辿れるようにする。
2. アバター／フレーム変更モーダルを `js/app-shell.js` に取り込み、全ページのヘッダーアバターから開けるようにする（現状、独立6ページでは `onAvatar` 未設定でクリック無反応）。

**Architecture:** バッチ2〜5の方式を踏襲。`index.html` は `<script src="/js/nav.js">` を追加して `nav: window.APP_NAV` を使う（`manageAuth:false` と各 `on*` ハンドラは維持）。アバターピッカーは app-shell.js がドロワーと同じ流儀で DOM を組み立て、`AVATARS`/`FRAMES` を app-shell のモジュール定数として持ち、保存後に `appShell.refreshAuth()` する。picker 用 CSS は `styles/theme.css` に追記。

**スコープの明確化（重要）:**
- **本バッチでは `index.html` の死にコード（抽出済みモーダルの markup・関数）は削除しない。** ナビを href 化すると `openScoresModal` 等は到達不能になるが、markup と関数はそのまま残す（無害）。
- **`index.html` から死にモーダル markup／関数を削除し、`loadRaceSection`/`updateAuthBar` を手術し、重複 CSS を撤去する作業は「バッチ7」として別計画で行う**（本番稼働中の3964行ファイルへの大量削除＝要・モーダル単位の検証。純粋なクリーンアップで機能追加は無い＝先送り可）。
- **`survey`** はアンケート終了済み・`APP_NAV` にも無い → 本バッチでは扱わない（バッチ7か、放置）。
- `index.html` の `onAvatar: openAvatarModal`（自前のピッカー）は**維持する**。app-shell の新ピッカーは `onAvatar` を渡さないページ（独立6ページ）でだけ既定動作として使われる。index.html は挙動不変。

---

## File Structure

| ファイル | 役割 | 変更種別 |
|---|---|---|
| `js/app-shell.js` | アバター／フレーム／名前変更モーダルを内蔵。`onAvatar` 未指定時の既定動作に。`AVATARS`/`AVATAR_NAMES`/`FRAMES`/`applyFrame` を内包。保存は `PUT /api/avatar` → `refreshAuth()`。 | 機能追加 |
| `styles/theme.css` | 末尾に picker CSS 追記（`.avatar-lg` / `.avatar-grid` / `.avatar-opt*` / `.frame-section*` / `.frame-grid` / `.frame-opt*` = index.html:394-408） | 追記のみ |
| `index.html` | `<script src="/js/nav.js">` 追加、`appShell.mount` の `nav:[…]` を `nav: window.APP_NAV` に。`manageAuth:false`・`onGoogleLogin`/`onIdLogin`/`onLogout`/`onNotif`/`onAvatar` は不変。 | 微修正（nav 差し替えのみ） |

---

## Task 1: `index.html` — ハンバーガーを `APP_NAV`（実 href）に

**Files:** Modify `index.html`。参照: `index.html:1691-1693`（script 並び）、`index.html:1762-1780`（`appShell.mount`）。

- [ ] **Step 0: 実ソース確認**

Run: `sed -n '1691,1694p;1762,1780p' index.html`
現状: `<script src="/js/util.js">` が最後の `/js/*`。`appShell.mount(...)` は `nav: [ {key:'home',href:'/'}, {key:'test',onClick:openTestModal}, … {key:'admin',onClick:openAdminModal,adminOnly:true} ]`（8項目）、続けて `manageAuth:false` ほか。

- [ ] **Step 1: `<script src="/js/nav.js"></script>` を追加**

`index.html` の `<script src="/js/util.js"></script>` の直後の行に追加：
```html
<script src="/js/util.js"></script>
<script src="/js/nav.js"></script>
<script>
```

- [ ] **Step 2: `nav: [ … ]` 配列を `nav: window.APP_NAV` に置換**

`appShell.mount(document.getElementById('app-shell-bar'), {` の直後の
```js
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
```
を、次の1行に置換：
```js
  nav: window.APP_NAV,
```
`manageAuth: false,` 以降（`onGoogleLogin`/`onIdLogin`/`onLogout`/`onNotif`/`onAvatar`）は**一切変更しない**。

> `window.APP_NAV`（`js/nav.js`）は `home`/`test`(→`/predict.html`)/`scores`/`clrank`/`battle`/`race`(`id:'race-view-btn'`)/`members`/`admin`(`adminOnly`) を実 `href` で定義済み。`race` 項目に `id: 'race-view-btn'` があるので、`loadRaceSection` の `document.getElementById('race-view-btn')` による表示制御はそのまま効く。`#race-view-bg` の markup も残すので `loadRaceSection` の `#race-view-bg` 参照行も throw しない。

- [ ] **Step 3: 検証 — nav.js 読み込み・配列除去・他不変**

```bash
grep -c 'src="/js/nav.js"' index.html            # → 1
grep -n 'onClick: openScoresModal\|onClick: openTestModal' index.html   # → 0件（配列が消えた）
grep -c 'nav: window.APP_NAV' index.html          # → 1
grep -c "manageAuth: false" index.html            # → 1（不変）
grep -c "onAvatar:      openAvatarModal" index.html # → 1（不変）
```

- [ ] **Step 4: インライン script が parse 可能か**

```bash
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const m=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n;\n');fs.writeFileSync('/tmp/idx.js',m);" && node --check /tmp/idx.js
```
Expected: 出力なし・exit 0

- [ ] **Step 5: 静的サーバ + 目視（Task 4 のブラウザ確認に集約でも可）**

```bash
(python3 -m http.server 8140 >/dev/null 2>&1 & echo $! >/tmp/s.pid); sleep 1
curl -s http://localhost:8140/index.html | grep -c 'src="/js/nav.js"'
kill $(cat /tmp/s.pid) 2>/dev/null
```
Expected: `1`

- [ ] **Step 6: コミット**

```bash
/usr/bin/git add index.html
/usr/bin/git commit -m "$(cat <<'EOF'
refactor(3-6): index.html のハンバーガーを APP_NAV（実 href）に

nav:[{onClick:openScoresModal}…] を nav:window.APP_NAV に差し替え、
js/nav.js を読み込み。各機能ページ（/scores.html 等）へ実遷移するようになる。
死にモーダルの markup/関数は残置（削除はバッチ7）。manageAuth/on* は不変。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KM28JJxt3JocdSahvonhec
EOF
)"
```

---

## Task 2: `styles/theme.css` — アバターピッカー CSS を追記

**Files:** Modify `styles/theme.css`（末尾）。参照: `index.html:394-408`。

- [ ] **Step 1:** Run `sed -n '392,409p' index.html` で対象確認。移すのは **picker 専用**の以下（バッチ2で意図的に外していた分）:
  `.avatar-lg` / `.avatar-grid` / `.avatar-opt` / `.avatar-opt:hover` / `.avatar-opt.selected` / `.avatar-opt-named` / `.avatar-opt-label` / `.avatar-opt-named.selected .avatar-opt-label` / `.frame-section` / `.frame-section h3` / `.frame-grid` / `.frame-opt` / `.frame-opt.selected::after`
  （`.avatar` と `.frame-*`（色定義）は既に theme.css にある。二重に入れない。）

- [ ] **Step 2:** `styles/theme.css` 末尾に追記：
```css

/* --- アバター／フレーム ピッカー（index.html:394-408） --- */
<上記セレクタ群を index.html から VERBATIM コピー>
```

- [ ] **Step 3: 検証**
```bash
node -e "
const fs=require('fs');const css=fs.readFileSync('styles/theme.css','utf8');
const need=['.avatar-lg','.avatar-grid','.avatar-opt','.avatar-opt.selected','.avatar-opt-named','.avatar-opt-label','.frame-section','.frame-grid','.frame-opt','.frame-opt.selected::after'];
let bad=0;for(const s of need){if(!css.includes(s)){console.log('MISSING',s);bad++;}}
console.log(bad?bad+' MISSING':'ALL PRESENT ('+need.length+')');
const o=(css.match(/{/g)||[]).length,c=(css.match(/}/g)||[]).length;console.log('braces',o,c,o===c?'BALANCED':'UNBALANCED');
"
```
Expected: `ALL PRESENT (10)` / `BALANCED`

- [ ] **Step 4:** `/usr/bin/git status --porcelain` → ` M styles/theme.css` のみ
- [ ] **Step 5: コミット**
```bash
/usr/bin/git add styles/theme.css
/usr/bin/git commit -m "$(cat <<'EOF'
refactor(3-6): アバターピッカー CSS を theme.css に追記

index.html <style>:394-408 と同一。app-shell の内蔵ピッカー用。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KM28JJxt3JocdSahvonhec
EOF
)"
```

---

## Task 3: `js/app-shell.js` — アバター／フレーム／名前変更モーダルを内蔵

**Files:** Modify `js/app-shell.js`。参照: `index.html:1696-1697`（`AVATAR_NAMES`/`AVATARS`）、`index.html:1723-1739`（`FRAMES`/`applyFrame`）、`index.html:979-1020`（`#avatar-modal-bg` markup）、`index.html:2165-2250`（`openAvatarModal`/`renderFrameGrid`/`selectFrame`/`closeAvatarModal`/`selectAvatar`/`saveAvatar`）。

**設計:**
- `app-shell.js` の IIFE 内に定数 `AVATARS` / `AVATAR_NAMES` / `FRAMES` と `applyFrame(el, frame)` を持つ（index.html:1696-1697/1723-1739 と同一）。
- ドロワー生成（`buildDrawer`）と同じ流儀で `buildAvatarModal()` を追加し、`document.body` に `<div class="modal-bg" id="appshell-avatar-modal">…</div>` を append。中身は index.html:979-1020 の `#avatar-modal-bg` の `.modal` 内部を踏襲（id は衝突回避のため `appshell-` プレフィックス、または index と同じでも可——独立ページには元 id が無いので同じで良い。ここでは**元と同じ id**（`avatar-modal-bg` / `avatar-preview` / `avatar-grid` / `frame-grid` / `username-input` / `modal-season-pts` / `modal-lifetime-pts` / `avatar-msg`）を使う）。
- `mount()` で `opts.onAvatar` が未指定なら `opts.onAvatar = openAvatarModal`（内蔵版）にする。`buildAvatarModal()` は mount 時に一度呼ぶ。
- 内蔵 `openAvatarModal` / `renderFrameGrid` / `selectFrame` / `closeAvatarModal` / `selectAvatar` / `saveAvatar` を index.html:2165-2250 から移植し、以下だけ変更：
  - `authAvatar`/`authFrame`/`authUser`/`authPoints`/`authLifetimePoints`/`authUnlockedAvatars` → `user` オブジェクト（`window.appShell.user`）から読む（`var av = user && user.avatar || '🐸'` 等）。
  - `lockScroll()` / `unlockScroll()` → 削除（または内部 no-op）。
  - `saveAvatar` の成功時：`localStorage` 書き込みは維持しつつ、`document.getElementById('auth-avatar')` 更新＋`updateAuthBar()` の代わりに `window.appShell.refreshAuth()` を呼ぶ（`/api/me` 再取得でヘッダー更新）。`window.api.put('/api/avatar', {...})` を使う（`api.js` の `window.api`）。
  - `selectedAvatar` / `selectedFrame` は IIFE ローカル変数に。
- `js/app-shell.js` 冒頭コメントの「使い方」に `onAvatar` 既定＝内蔵ピッカー、を追記。

- [ ] **Step 0: 実ソース確認**
```bash
sed -n '1696,1697p;1723,1739p' index.html   # AVATARS / AVATAR_NAMES / FRAMES / applyFrame
sed -n '979,1020p' index.html               # #avatar-modal-bg markup
sed -n '2165,2250p' index.html              # openAvatarModal / renderFrameGrid / selectFrame / closeAvatarModal / selectAvatar / saveAvatar
```

- [ ] **Step 1: `js/app-shell.js` を編集**（上記設計どおり）。既存の `window.appShell` の公開 API（`mount`/`refreshAuth`/`logout`/`update`/`setBadge`/`user`/`token`）は壊さない。`buildAvatarModal` は `buildDrawer` の直後で呼ぶ。

- [ ] **Step 2: 構文チェック**
```bash
node --check js/app-shell.js
```
Expected: 出力なし・exit 0

- [ ] **Step 3: 移植関数のロジック照合**
```bash
node -e "
const fs=require('fs');
const idx=fs.readFileSync('index.html','utf8'), sh=fs.readFileSync('js/app-shell.js','utf8');
console.log('AVATARS 50個:', (sh.match(/'🐸','🐙'/)||[]).length===1 ? 'OK':'BAD');
console.log('FRAMES worst/baka hidden:', sh.includes(\"id: 'worst'\")&&sh.includes('hidden: true')?'OK':'BAD');
console.log('applyFrame 定義:', /function applyFrame\(/.test(sh)?'OK':'BAD');
console.log('saveAvatar が /api/avatar:', sh.includes('/api/avatar')?'OK':'BAD');
console.log('refreshAuth 呼び出し:', /saveAvatar[\s\S]{0,600}refreshAuth\(\)/.test(sh)?'OK':'BAD');
console.log('mount で onAvatar 既定:', /onAvatar[\s\S]{0,80}openAvatarModal/.test(sh)?'OK':'BAD');
console.log('lockScroll 未使用:', !sh.includes('lockScroll')?'OK':'BAD');
"
```
Expected: 全 `OK`

- [ ] **Step 4: 静的サーバ + ブラウザ（Task 4 に集約可）** — 最低限、`js/app-shell.js` が 200 で配信され、`curl | grep -c 'buildAvatarModal'` が 1。

- [ ] **Step 5:** `/usr/bin/git status --porcelain` → ` M js/app-shell.js` のみ（Task 2 の theme.css は別コミット済み）
- [ ] **Step 6: コミット**
```bash
/usr/bin/git add js/app-shell.js
/usr/bin/git commit -m "$(cat <<'EOF'
refactor(3-6): アバターピッカーを app-shell.js に内蔵

AVATARS/AVATAR_NAMES/FRAMES/applyFrame と avatar-modal-bg を app-shell が生成。
onAvatar 未指定時の既定動作に（独立6ページのヘッダーアバターが機能する）。
保存は PUT /api/avatar → refreshAuth()。auth* は appShell.user から読む。
index.html は自前の openAvatarModal を維持するため挙動不変。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KM28JJxt3JocdSahvonhec
EOF
)"
```

---

## Task 4: ブラウザ確認（claude-in-chrome / 静的サーバ）＋メモリ更新

**Files:** Modify `/Users/sho/.claude/projects/-Users-sho-work-MutoMosiEigo/memory/architecture-refactor-2026-09.md`。

- [ ] **Step 1: 静的サーバ起動**（worktree ルートから `python3 -m http.server`。既存の http.server プロセスを `pkill -9 -f http.server` してから）

- [ ] **Step 2: `index.html`**
  - [ ] ハンバーガーを開く → 各項目が `<a href="/predict.html">` 等（`onClick` ではない）。クリックで実遷移（静的サーバなら 200 で該当ページが開く）
  - [ ] 未ログイン時、認証必須項目（テスト予測/成績/クラス順位/バトル/メンバー/管理）が隠れ、ホーム・レースだけ出る（`[hidden]` ＋ `data-auth`）
  - [ ] ホーム本体（試験フォルダ一覧・ランキング・時間割カード・お知らせ）が従来通り描画、コンソールに新規エラーなし
  - [ ] `race` 項目：レース非開催時に隠れる（`loadRaceSection` が `#race-view-btn` を制御）
  - [ ] ヘッダーのアバターをクリック → 自前モーダル（`#avatar-modal-bg`）が開く（index.html は挙動不変）

- [ ] **Step 3: 独立ページ（`/scores.html` 等どれか1つ）**
  - [ ] ヘッダーのアバターをクリック → **app-shell 内蔵ピッカーが開く**（アバターグリッド・フレームグリッド・名前入力）
  - [ ] （段階2）ログイン状態で保存 → `PUT /api/avatar` → ヘッダーのアバター/名前が更新（`refreshAuth`）
  - [ ] ハンバーガーから他ページへ遷移できる

- [ ] **Step 4: メモリ更新** — 「フェーズ3 バッチ6 完了」を追記。残＝バッチ7（index.html 死にコード削除・CSS 撤去・survey）／フェーズ4。

- [ ] **Step 5:** `git log --oneline -6` に `refactor(3-6)` ×3（index.html nav / theme.css picker / app-shell avatar）

---

## Self-Review

**1. Spec coverage（design doc フェーズ3）:** 「`APP_SHELL_NAV_OVERRIDES` を外して素の `href` 遷移に」→ Task 1。「ログインも `login.html` に分離」→ バッチ4済。「アバターを app-shell へ」→ Task 2+3。「`index.html` は目次だけに」＝死にコード削除は**バッチ7**に分離（明記）。

**2. Placeholder scan:** Task 1 は具体的な置換前後を全文明記。Task 2 は「index.html:394-408 を VERBATIM」＋照合。Task 3 は app-shell.js の新規コードなので設計を詳細記述＋照合スクリプト（逐語の modal HTML と関数本体は index.html を写す指示＋変更点を列挙）。app-shell.js 改修は「新規記述」なので実装者判断が要る部分がある——`buildDrawer` の既存パターンに合わせること、公開 API を壊さないこと、を制約として明記済み。

**3. Type consistency:**
- `window.APP_NAV`（nav.js）— Task 1 で index.html が参照。既存の独立ページと同一。✓
- `openAvatarModal` — Task 3 で app-shell.js 内に定義、`mount` の `onAvatar` 既定に。index.html の同名関数（グローバル）とは別スコープ（IIFE 内）。index.html は自前を `onAvatar:` で明示的に渡すので衝突しない。✓
- `applyFrame` — Task 3 で app-shell.js の IIFE 内に定義。index.html のグローバル `applyFrame`（1735）とは別物・別スコープ。✓
- `window.api.put` — `js/api.js` が公開（`put: function(p,b){...}`）。Task 3 の `saveAvatar` が使う。✓
- `window.appShell.refreshAuth` — 既存。Task 3 の `saveAvatar` が保存後に呼ぶ。✓
- id 重複: 内蔵ピッカーは `#avatar-modal-bg` 等・index.html の同名要素と**同じ id**を使うが、独立ページには元 id が無いので実害なし。index.html 上では app-shell 版と index 版の2つの `#avatar-modal-bg` が DOM に存在しうる → **index.html は `onAvatar: openAvatarModal`（自前）を渡すので app-shell 版 modal は開かれない**が、`buildAvatarModal()` が mount 時に app-shell 版を body へ append する点に注意。id 衝突で `getElementById` が最初の要素を返す → index.html の自前 `openAvatarModal` が app-shell 版の空要素を掴む可能性。**対策: app-shell 内蔵ピッカーの id は `appshell-` プレフィックスにする**（Task 3 Step 1 でプレフィックス版を採用し、内蔵関数もそのプレフィックス id を参照する）。Self-review で方針変更 → Task 3 は `appshell-avatar-modal` / `appshell-avatar-grid` 等のプレフィックス id を使うこと。
