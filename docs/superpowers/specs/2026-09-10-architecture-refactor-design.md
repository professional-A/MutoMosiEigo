# アーキテクチャ改善 設計書

- 日付: 2026-09-10
- 状態: フェーズ1 設計確定 / フェーズ2〜4 概要のみ（各フェーズ着手時に個別 spec を作成）
- 実装方式: **マルチページ**（各機能を独立した `.html`、`express.static('.')` のまま、ビルドツールなし）

## 背景と問題

新しいテストを追加するたびに手作業が発生し、フロントが1枚岩になっている。コードを読んで確認した非効率:

| # | 問題 | 具体 |
|---|------|------|
| A | コンテンツ追加のたびに手作業 | `tests.json`（手書きの索引）を毎回追記。実体 `tests/*/data.json` と二重管理でズレる。旧方式の per-test HTML（英語模試・step1〜4・再試験・handout）が残存。クイズエンジンが `quiz-engine.js` と `nekku-engine.js` の2本で、`quiz.html` が `data.problems` の有無で出し分け。変換は `convert-quiz-html.js` の TARGETS 配列を都度書き換え |
| B | `index.html` が4062行の1枚岩 | 英語模試データ + 管理UI + レース + バトル + 成績 + アンケート + ログイン + アバター + 日程 + 時間割 + バナー が同居。`<style>` 447行、`<script>` 約2800行、関数167個（すべてグローバル、`onclick="openXxx()"` 直書き）、`modal-bg` 14個。テーマCSS変数（`--bg` 等）が `index.html` / `quiz-engine.js` / `nekku-engine.js` / 各テストHTMLで別々に再定義 |
| C | ヘッダーがごちゃごちゃ | `auth-bar` に常時ボタン12個（管理 / メンバー / 📊成績 / ⚔️バトル / 🏆順位 / 🏁レース / avatar / 📋テスト / IDでログイン / Googleでログイン / 🔔）。スマホ幅で折り返して崩れる。まとめ役がない |
| D | なんでもモーダル | 成績・バトル・レース・管理（巨大）・アンケート・日程・時間割・メンバー・アバター・テスト予測が全部モーダル。URL直リンク不可・ブラウザバック不可・共有不可。モーダル内モーダル（管理→日程 / 管理→時間割）で状態が絡む |
| E | サーバー側の重複 | 科目ごとの採点API（`/api/ouri/score` `/api/math/score` `/api/kakougaku/score` `/api/nekku/score` `/api/seigyo/score`）。「使用後削除予定」の一時エンドポイントがコミットに残る。`server.js` 1702行にルーティング / SQL / DDL が未分離 |

## 目標の構造

```
styles/theme.css   ← テーマ変数（--bg 等）と data-theme 別テーマ、共通部品の唯一の定義
js/api.js          ← fetch + 認証トークン付与 + JSON/エラー処理の薄いラッパ
js/app-shell.js    ← 共通ヘッダー + ハンバーガーメニュー + ログイン状態管理（全ページ共通）

index.html         ← 全科目の目次／ランディングのみ（作問データを持たない）
quiz.html          ← data.json 駆動・全テスト共通（エンジン1本に統合）
scores.html / battle.html / race.html / admin.html / survey.html ← 各機能を独立ページに

tests/*/data.json  ← コンテンツのみ
/api/tests         ← tests/ を走査して索引を自動生成（tests.json 手編集を廃止）
```

## フェーズ分割（独立・順に実施）

1. **共有基盤** — `theme.css` / `api.js` / `app-shell.js` を作り、まず `index.html` を載せ替え。既存の機能・モーダルはそのまま。（本書で詳細設計）
2. **コンテンツ・パイプライン** — `/api/tests` で索引自動生成、クイズエンジン統合（nekku → quiz 1本）、変換スクリプト廃止、旧 per-test HTML（英語模試含む）を `data.json` 化。P1 に依存。
3. **モーダル → 独立ページ** — 成績・バトル・レース・管理・アンケートを `app-shell` を土台にマルチページ化。URL直リンク・バック可。P1 に依存、P2 とは独立。
4. **サーバー整理（任意）** — 採点API を `/api/score/:subject` 等に1本化、`server.js` をルート単位に分割、一時エンドポイント運用の見直し。他と独立。

---

# フェーズ1 詳細設計 — 共有基盤

## スコープ

**やる:**

- `styles/theme.css` を新規作成。**テーマ変数（`index.html` の現状値）＋ reset 2行 ＋ `data-theme` 別テーマ3ブロック ＋ app-shell 用スタイル**のみ。`.wrap` 等の共通プリミティブは P1 では移さない。
- `js/api.js` を新規作成。`window.api` に `get/post/put/del` を生やす（P1 では配置のみ、呼び出し元は後フェーズ）。
- `js/app-shell.js` を新規作成。ダムなビュー（`appShell.mount/update/setBadge`）。ヘッダーバー（ロゴ / 🔔 / アバター＋名前 / ☰）とドロワーを描画。
- `index.html` を載せ替え。手書き `auth-bar` を `#app-shell-bar` に、inline の `:root`＋reset＋テーマ3ブロックを `theme.css` に。ドロワー項目は既存モーダルを開く。認証状態の管理は `updateAuthBar()` に残す。

**やらない（後フェーズ）:**

- モーダルを独立ページに分ける（P3）。P1 ではドロワーのリンクは既存のモーダル開閉関数を呼ぶだけ。
- `tests.json` 自動生成・クイズエンジン統合・英語ページの `data.json` 化（P2）。
- `server.js` の変更（一切触らない）。
- `index.html` の本体（英語模試・各モーダルのマークアップ・167関数）の移動やリファクタ。ガワだけ差し替える。
- `quiz.html` / `quiz-engine.js` / `nekku-engine.js` / `tests/*` の変更。`theme.css` はこれらが後で `:root` ブロックを捨てられる形で書くが、P1 では読み込ませない。
- `index.html` の fetch 呼び出し（167関数側）の `api.js` への移行。P1 では `api.js` は配置するだけで呼び出さない。認証復元も現状コードのまま。

## コンポーネント

### `styles/theme.css`

- **役割:** テーマとレイアウト共通部品の唯一の定義。全ページが `<link rel="stylesheet" href="/styles/theme.css">` で読む（P1 では `index.html` のみ）。
- **内容（P1 では最小限に留める）:**
  - `:root` にテーマ変数を **`index.html` の現状値そのまま**（`quiz-engine.js` とは値が微妙に違うが、P1 は「`index.html` の見た目を変えない」が最優先。エンジンとの統一は P2）:
    `--bg:#0a1626; --bg2:#0e1d33; --card:#15263f; --card2:#0e1d33; --line:#27406a; --ink:#e7eef7; --muted:#8aa1c0; --dim:#5f7c9c; --fg:#e7eef7; --teal:#46d6c4; --amber:#f6b352; --rose:#f0716e;`
  - `*{box-sizing:border-box;margin:0;padding:0}` と `html{scroll-behavior:smooth}`（`index.html` 冒頭にある2行）。
  - `[data-theme="purple"]` / `[data-theme="forest"]` / `[data-theme="charcoal"]` の変数上書き3ブロック（現状 `index.html` の `<style>` 20〜22行をそのまま移設。navy は無属性）。
  - app-shell 用スタイル（新規）: ヘッダーバー、`☰` ボタン、ドロワー（右からスライド）、バックドロップ、ドロワー項目。
  - **`.wrap` / `body` / `.modal-bg` / ボタン等の共通プリミティブは P1 では移動しない**（`index.html` の `<style>` に残す）。他ページが必要になる P2/P3 で、そのとき触るページの CSS を見ながら `theme.css` へ昇格させる。
- **`index.html` 側:** inline `<style>` から `:root` ブロック（12〜16行）・`*{...}`・`html{...}`（17〜18行）・3テーマブロック（20〜22行）だけを削除し、先頭で `theme.css` を `<link>`。他の CSS ルールは一切動かさない。視覚的な結果は変わらないこと。

### `js/api.js`

- **役割:** 認証付き fetch の一本化。`points.js` / `progress.js` に重複している `getToken()` と同じ規則を1か所に。
- **API:** `window.api = { get(path), post(path, body), put(path, body), del(path) }`。すべて `Promise` を返し、2xx 以外で `Error`（`err.status` / `err.body` を持つ）を throw。2xx は JSON をパースして返す（空ボディは `null`）。
- **トークン:** `localStorage.muto_session` を優先。無ければ Supabase の `session.access_token`（`window.supabase` があれば）。ヘッダーは `Authorization: <token>`（**"Bearer " プレフィックスは付けない**。現状に合わせる）。取得結果はメモ化。
- **`points.js` / `progress.js`:** P1 では変更しない（重複は残す）。P2 以降でこれらも `api.js` 利用に寄せる。

### `js/app-shell.js`

**設計方針（P1）:** app-shell は「見た目の入れ物（ヘッダーバー＋ドロワー）」だけを持つ**ダムなビュー**。認証状態の取得・保持は現状どおり `index.html` の `updateAuthBar()` 側に残し、そこから app-shell の描画メソッドを呼ぶ。`index.html` の `#header-stack` / `syncLayout()` / ResizeObserver / `ticker-wrap` / `notif-panel` には**触らない**（app-shell の DOM は `#header-stack` 内の差し替え済みノードに描画される）。

- **公開 API:** `window.appShell = { mount(el, opts), update(state), setBadge(n) }`
  - `mount(el, opts)`: `el`（`#app-shell-bar`）にヘッダーバー DOM を構築し、ドロワーとバックドロップを `<body>` 直下に追加。`opts`:
    - `opts.nav`: ドロワー項目の配列 `[{ key, icon, label, href?, onClick?, adminOnly? }]`
    - `opts.onGoogleLogin` / `opts.onIdLogin` / `opts.onLogout` / `opts.onNotif` / `opts.onAvatar`: 各ハンドラ（すべて `index.html` の既存関数を渡す）
  - `update(state)`: `state = { loggedIn, name, points, avatar, isAdmin }`。ヘッダー右側（未ログイン: `[IDでログイン][Googleでログイン]`／ログイン中: `🔔` + `🐸名前` + `☰`）とドロワー先頭行（`🐸 名前 ・ N pt`）、`adminOnly` 項目の表示可否を切り替える。
  - `setBadge(n)`: 🔔 のバッジ数。
- **ドロワー:** 右からスライドイン + バックドロップ。全幅で同じ挙動（デスクトップでも `☰`）。
  - 項目クリック: `onClick` があれば呼ぶ（＝ P1 では既存モーダルを開く）。無ければ `href` に遷移。どちらの場合もドロワーを閉じる。
  - Esc で閉じる / バックドロップクリックで閉じる / `☰` に `aria-expanded` を反映 / 開いている間は最初の項目にフォーカス。
- **`api.js` 依存なし。** app-shell 自身は fetch しない（認証は index 側）。

### `index.html`（P1 での変更）

1. `<head>` の `<style>` の**直前**に `<link rel="stylesheet" href="/styles/theme.css">` を追加。
2. inline `<style>` から次だけを削除（他は一切動かさない）: `:root{…}`（12〜16行）、`*{box-sizing…}`（17行）、`html{scroll-behavior…}`（18行）、`[data-theme="purple"|"forest"|"charcoal"]` の3行（20〜22行）。※19行のコメント `/* テーマプリセット */` も削除。
3. `<div class="auth-bar" id="auth-bar"> … </div>`（463〜481行）を丸ごと `<div id="app-shell-bar"></div>` に置換。`#header-stack` の開始/終了タグ、`ticker-wrap`、`notif-panel` はそのまま。
4. 主 inline スクリプトの**前**に `<script src="/js/app-shell.js"></script>` を追加（`api.js` は P1 の app-shell では不要。ただし今後のために `<script src="/js/api.js"></script>` も同時に追加してよい。読み込むだけで副作用なし）。
5. `updateAuthBar()`（1830〜1866行付近）を改修:
   - 冒頭の `getElementById('auth-status'|'auth-open-btn'|'pw-open-btn'|'auth-avatar')` と、それらへの `innerHTML`/`textContent`/`style.display`/`onclick` 代入、`test-btn`/`admin-btn`/`members-btn`/`scores-btn`/`clrank-btn`/`battle-btn` の `style.display` 行を削除。
   - 代わりに `appShell.update({ loggedIn: !!authToken, name: tu(authUser), points: authPoints, avatar: authAvatar, isAdmin: authEmail === 'kabu6113450@gmail.com' })` を呼ぶ。
   - `loadRanking()` / `loadBanners()` / `loadRaceSection()` / `notif-post-section` の `style.display` / 末尾の `requestAnimationFrame(syncLayout)` は**そのまま残す**。
6. 初期化（`updateAuthBar` を最初に呼ぶ場所の前）で1回だけ `appShell.mount(document.getElementById('app-shell-bar'), { nav: [...], onGoogleLogin: loginWithGoogle, onIdLogin: openLoginModal, onLogout: doLogout, onNotif: toggleNotif, onAvatar: openAvatarModal })` を実行。`nav` は下記。
   - `{ key:'home',   icon:'🏠', label:'ホーム',        href:'/' }`
   - `{ key:'test',   icon:'📋', label:'テスト予測',    onClick: openTestModal }`
   - `{ key:'scores', icon:'📊', label:'成績',          onClick: openScoresModal }`
   - `{ key:'clrank', icon:'🏆', label:'クラス順位',    onClick: openClrankPage }`
   - `{ key:'battle', icon:'⚔️', label:'バトル',        onClick: openBattleModal }`
   - `{ key:'race',   icon:'🏁', label:'レース',        onClick: openRaceView }`
   - `{ key:'members',icon:'👥', label:'メンバー',      onClick: openMembersModal }`
   - `{ key:'admin',  icon:'🛠', label:'管理',          onClick: openAdminModal, adminOnly:true }`
7. `notif-badge` の更新箇所があれば `appShell.setBadge(n)` も呼ぶ（無ければ初期値のまま。P1 では必須でない）。
8. `loadTheme()` / `applyTheme()` は変更しない（`data-theme` 値は `theme.css` のセレクタと一致させる）。

## データフロー（P1）

```
ページ読込
  → theme.css 適用（+ 既存 loadTheme が localStorage.mutou_theme を data-theme に）
  → app-shell.js ロード（window.appShell、副作用なし）
  → api.js ロード（window.api、P1 では未使用だが配置）
  → index.html 主スクリプト初期化:
       appShell.mount(#app-shell-bar, { nav, onGoogleLogin: loginWithGoogle, ... })
  → 既存の認証復元処理（/api/me 等）→ authToken/authUser/authEmail/authPoints を設定
  → updateAuthBar():
       appShell.update({ loggedIn, name, points, avatar, isAdmin })   ← ヘッダー右側＋ドロワー先頭行＋管理項目
       loadRanking() / loadBanners() / loadRaceSection() / notif-post-section 表示 / syncLayout()  ← 従来どおり
  → ☰ クリック: ドロワー開閉。項目クリックは nav[].onClick（既存モーダル）を呼ぶ or href 遷移
```

## エラー処理

- `api.*` は 2xx 以外で `Error`（`status` / `body` 付き）を throw。呼び出し側で捕捉。P1 では呼び出し元がまだ無い（配置のみ）。
- 認証復元（`/api/me` 等）の失敗時挙動は**現状の `index.html` のまま**（P1 で変更しない）。app-shell は `updateAuthBar()` が渡す `loggedIn:false` を表示するだけ。
- `appShell.mount` に渡す要素が `null`: 何もしない（コンソール警告のみ）。P1 では `index.html` に必ず `#app-shell-bar` があるので通らない。
- `theme.css` が 404: ページは素の色で表示されるだけ（機能は動く）。`npm start` での確認で担保。

## テスト / 検証（テストフレームワークなし・手動チェックリスト）

- 未ログインで `/` を開く → ヘッダーに `[IDでログイン][Googleでログイン]` と `☰`。`☰` は開閉、Esc・バックドロップで閉じる。ドロワーは「ホーム」のみ。
- IDログイン・Googleログイン両方 → ヘッダーが `🔔` + `🐸名前` + `☰` に。ドロワーに全7項目 + `N pt`。`🛠 管理` は管理者メールの時だけ表示。
- ドロワー各項目 → 対応する既存モーダルが開く（成績 / 順位 / バトル / レース / メンバー / テスト予測 / 管理）。
- `🔔` → お知らせパネル。アバター → アバターモーダル。`ログアウト` → 未ログイン状態に戻る。
- テーマ切替（管理モーダル内）→ navy / purple / forest / charcoal が今までどおり効く。リロード後も保持。
- 色・レイアウトが従来と視覚的に一致（スクショ比較）。
- `quiz.html` と `tests/*` のページが従来どおり表示される（P1 では未変更）。
- コンソールエラーなし。

## リスク

| リスク | 対策 |
|--------|------|
| 主 inline スクリプトの「dead code 削除」で、`auth-bar` の要素IDを参照する他機能が壊れる | 削除前に各ID（`scores-btn` `admin-btn` 等）を全文検索。不安が残るものは `display:none` の隠しスタブを残す |
| `api.js` のトークン規則が `points.js`/`progress.js` と食い違う | `getToken()` の実装（`muto_session` 優先 → Supabase）を逐語コピー。ヘッダーは `Authorization: <token>`（Bearer なし） |
| `applyTheme` の `data-theme` 値と `theme.css` のセレクタ不一致でテーマが壊れる | 現状の3ブロックをそのまま移設。navy=無属性を維持 |
| `index.html` を開いて確認する運用なので、絶対パス `/styles/theme.css` がローカルの file:// で解決しない | 確認は `npm start`（`http://localhost:3000`）で行う旨を検証手順に明記 |

---

# フェーズ2〜4（概要）

着手時にそれぞれ個別 spec を作成する。

## フェーズ2 — コンテンツ・パイプライン

- **`/api/tests`**: `server.js` に、起動時 or リクエスト時に `tests/*/data.json` を走査して索引（year / grade / exam / subject / title / path / storageKey / totalItems）を組み立てて返すエンドポイント。`tests.json` 手編集を廃止。アーカイブ情報は現状の `exam_schedule` テーブルと突き合わせ。
- **エンジン統合**: `nekku-engine.js` の機能を `quiz-engine.js` に取り込み、`data.problems` は1つの問題タイプ or セクション種別として扱う。`quiz.html` の出し分け（`data.problems ? nekku : quiz`）を削除。
- **旧 per-test HTML の `data.json` 化**: 英語模試（`tests/2026-4-zenki-chukan-eigo/` ほか）・step1〜4・再試験・handout。必要なら新しい問題タイプ（フラッシュカード、本文つき設問）を `data.json` スキーマに追加。→ CLAUDE.md「科目の扱い（重要）」の方針（英語も他科目と同等に `data.json` 化）に沿う。
- **`convert-quiz-html.js` 廃止**。
- **`theme.css` を `quiz-engine.js` にも適用**し、エンジン内の CSS 文字列から `:root` を撤去。

## フェーズ3 — モーダル → 独立ページ

- `scores.html` / `battle.html` / `race.html` / `admin.html` / `survey.html` を作成。各ページは `theme.css` + `api.js` + `app-shell.js` を読み、本体だけを持つ。
- `index.html` から対応するモーダルのマークアップと関数群を移動。`APP_SHELL_NAV_OVERRIDES` を外して素の `href` 遷移に。
- 管理ページ内モーダル（日程 / 時間割）はページ内セクション or 子ページに。
- ログインも `login.html` に分離（それまで `index.html` のモーダルを共用）。
- `index.html` は「全科目の目次」だけになる（`/api/tests` を使う）。

## フェーズ4 — サーバー整理（任意）

- 科目別採点API（`/api/ouri/score` 等5本）を `/api/score/:subject`（or ボディで科目指定）1本に統合。呼び出し側（各エンジン / `points.js`）を追従。
- `server.js` をルート単位のモジュールに分割（`routes/battles.js` 等）。DDL は `schema.sql` or 初期化モジュールへ。
- 「使用後削除予定」の一時エンドポイントは、コミットに残さない運用（別ブランチ / ローカルスクリプト）に。

## 関連

- CLAUDE.md「科目の扱い（重要）」「アーキテクチャ改善（進行中）」
- メモリ: `architecture-refactor-2026-09` / `english-is-a-normal-subject`
