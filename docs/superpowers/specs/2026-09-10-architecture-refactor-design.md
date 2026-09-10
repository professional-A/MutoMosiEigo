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

- `styles/theme.css` を新規作成。テーマ変数・`data-theme` 別テーマ・共通プリミティブ（reset / body / `.wrap` / ボタン / フォーム / `.modal-bg`・`.modal`）・app-shell 用スタイルを集約。
- `js/api.js` を新規作成。`window.api` に `get/post/put/del` を生やす。
- `js/app-shell.js` を新規作成。`<div id="app-shell">` にヘッダー（ロゴ / 🔔 / アバター＋名前 / ☰）とドロワーを描画。
- `index.html` を上記3点に載せ替え。手書き `auth-bar` と inline のテーマCSSを撤去。ドロワー項目は既存モーダルを開く。

**やらない（後フェーズ）:**

- モーダルを独立ページに分ける（P3）。P1 ではドロワーのリンクは既存のモーダル開閉関数を呼ぶだけ。
- `tests.json` 自動生成・クイズエンジン統合・英語ページの `data.json` 化（P2）。
- `server.js` の変更（一切触らない）。
- `index.html` の本体（英語模試・各モーダルのマークアップ・167関数）の移動やリファクタ。ガワだけ差し替える。
- `quiz.html` / `quiz-engine.js` / `nekku-engine.js` / `tests/*` の変更。`theme.css` はこれらが後で `:root` ブロックを捨てられる形で書くが、P1 では読み込ませない。
- `index.html` の他の fetch 呼び出し（167関数側）の `api.js` への移行。P1 では app-shell が使う認証・`/api/me` 周りのみ。

## コンポーネント

### `styles/theme.css`

- **役割:** テーマとレイアウト共通部品の唯一の定義。全ページが `<link rel="stylesheet" href="/styles/theme.css">` で読む（P1 では `index.html` のみ）。
- **内容:**
  - `:root` にテーマ変数（現状 `quiz-engine.js` のパレットを正とする）:
    `--bg:#0a1626; --bg2:#0e1d33; --card:#15263f; --card2:#1b2f4d; --line:#27406a; --ink:#e7eef7; --muted:#8aa1c0; --dim:#5f7c9c; --teal:#46d6c4; --teal-d:#1f9e90; --amber:#f6b352; --rose:#f06b8e; --good:#5fe0a8; --bad:#f06b8e`
  - `:root[data-theme="purple"]` / `[data-theme="forest"]` / `[data-theme="charcoal"]` の変数上書き（現状 `index.html` の `<style>` にある3ブロックをそのまま移設。navy は無属性）。
  - 共通プリミティブ: `*{box-sizing:border-box;margin:0;padding:0}`、`body` の背景・フォント、`.wrap`（`max-width` コンテナ）、ボタン基本、フォームコントロール、`.modal-bg` / `.modal`（P3 まで残るモーダル用）。
  - app-shell 用: ヘッダーバー、`☰` ボタン、ドロワー（右からスライド）、バックドロップ。
- **`index.html` 側:** inline `<style>` からテーマ変数と上記プリミティブ・4テーマブロックを削除。`index.html` 固有ルール（フォルダカード、ticker、各モーダル固有の見た目など）だけ残す。視覚的な結果は変わらないこと。

### `js/api.js`

- **役割:** 認証付き fetch の一本化。`points.js` / `progress.js` に重複している `getToken()` と同じ規則を1か所に。
- **API:** `window.api = { get(path), post(path, body), put(path, body), del(path) }`。すべて `Promise` を返し、2xx 以外で `Error`（`err.status` / `err.body` を持つ）を throw。2xx は JSON をパースして返す（空ボディは `null`）。
- **トークン:** `localStorage.muto_session` を優先。無ければ Supabase の `session.access_token`（`window.supabase` があれば）。ヘッダーは `Authorization: <token>`（**"Bearer " プレフィックスは付けない**。現状に合わせる）。取得結果はメモ化。
- **`points.js` / `progress.js`:** P1 では変更しない（重複は残す）。P2 以降でこれらも `api.js` 利用に寄せる。

### `js/app-shell.js`

- **役割:** 全ページ共通のヘッダーとナビゲーション、ログイン状態の管理。
- **描画:** DOMContentLoaded で `#app-shell` を探し（無ければ `<body>` 先頭に生成）ヘッダーを描画。
  - **ロゴ** 「武藤模試」→ `/` へのリンク。
  - **右クラスタ（未ログイン）:** `[IDでログイン]` `[Googleでログイン]` `☰`（ドロワーは「🏠 ホーム」のみ）。
  - **右クラスタ（ログイン中）:** `🔔`（バッジ付き）/ `🐸 名前` / `☰`。
- **ドロワー:** 右からスライドイン + バックドロップ。全幅で同じ挙動（デスクトップでも `☰`）。
  - 先頭行: `🐸 名前 ・ N pt`
  - 項目: `🏠 ホーム` `/` / `📋 テスト予測` / `📊 成績` / `🏆 クラス順位` / `⚔️ バトル` / `🏁 レース` / `👥 メンバー`
  - 管理者のみ: `🛠 管理`（`authEmail === 'kabu6113450@gmail.com'`）
  - `ログアウト`
  - Esc で閉じる / バックドロップクリックで閉じる / `aria-expanded` を反映 / フォーカストラップ。
- **ナビの遷移先（重要・移行方式）:** `app-shell.js` は項目を「キー付き設定」として持つ。既定は将来の `href`（`/scores.html` 等）。ただし各ページは読み込み前に `window.APP_SHELL_NAV_OVERRIDES = { scores: () => openScoresModal(), battle: () => openBattleModal(), ... }` を定義でき、その場合はクリックで `href` 遷移せずハンドラを呼ぶ。→ P1 の `index.html` は全項目に既存モーダル開閉関数を割り当てる。P3 で各ページ実体ができたら override を外す。
- **認証:**
  - `api.get('/api/me')` でユーザー情報を取得し、名前 / ポイント / アバター / 管理者フラグを反映。失敗時は未ログイン表示に戻し `muto_session` を消す（現状 `index.html` の挙動を踏襲）。
  - `window.appShell = { user, refresh(), on(evt, cb) }` を公開。`'authchange'` イベントで `index.html` 側が既存UI（スコアバー等）を更新できる。
  - `[Googleでログイン]` は既存 `loginWithGoogle()` を呼ぶ（Supabase OAuth）。`[IDでログイン]` は既存 `openLoginModal()` を呼ぶ（ログインモーダルのマークアップは P1 では `index.html` に残す）。P1 では app-shell は「トリガーするだけ」。
  - `🔔` は既存 `toggleNotif()`、アバターは既存 `openAvatarModal()`、`ログアウト` は既存のログアウト処理を呼ぶ（override 機構と同じ方式で `index.html` から関数を渡す）。

### `index.html`（P1 での変更）

- `<head>` に `<link rel="stylesheet" href="/styles/theme.css">` を追加。
- inline `<style>` からテーマ変数・4テーマブロック・共通プリミティブを削除（`theme.css` へ移設済みのもの）。
- `<div id="header-stack">` 内の `auth-bar` マークアップを `<div id="app-shell"></div>` に置換。`ticker-wrap` / `notif-panel` / 全モーダルは現状維持。
- `<script src="/js/api.js">` → `<script src="/js/app-shell.js">` を主 inline スクリプトの前に追加。
- 主 inline スクリプト内の「`auth-bar` のボタン表示切替」ブロック（`document.getElementById('scores-btn').style.display = ...` 等、1841〜1864行付近）を削除し、`appShell.on('authchange', …)` で残りのUI（スコアバー・管理セクション表示）だけ更新するよう最小改修。
- `window.APP_SHELL_NAV_OVERRIDES` と、`🔔`・アバター・ログアウト用のハンドラを定義。
- `loadTheme()` / `applyTheme()` は残す（テーマ切替UIは管理モーダル内にあるため P1 では現状維持。`applyTheme` が触る `data-theme` 属性は `theme.css` 側の定義と一致させる）。

## データフロー（P1）

```
ページ読込
  → theme.css 適用（+ applyTheme が localStorage.mutou_theme を data-theme に）
  → api.js ロード（window.api）
  → app-shell.js: #app-shell 描画 → api.get('/api/me')
      ├ 成功: ヘッダーをログイン状態に / appShell.user 設定 / 'authchange' 発火
      └ 失敗: 未ログイン表示 / muto_session 削除 / 'authchange' 発火
  → index.html 主スクリプト: 'authchange' を受けてスコアバー・管理セクションを更新
  → ☰ クリック: ドロワー開閉。項目クリックは APP_SHELL_NAV_OVERRIDES 経由で既存モーダルを開く
```

## エラー処理

- `api.*` は 2xx 以外で `Error`（`status` / `body` 付き）を throw。呼び出し側で捕捉。
- `/api/me` 失敗・トークン無効: 未ログイン表示にフォールバック、`muto_session` 削除。例外を投げない。
- `#app-shell` が存在しないページ: `<body>` 先頭に生成（安全側）。
- `theme.css` が 404: ページは素の色で表示されるだけ（機能は動く）。デプロイ確認で担保。

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
