# CLAUDE.md

## スタック

- **ランタイム**: Node.js + Express
- **DB**: Supabase PostgreSQL（`DATABASE_URL` 環境変数）
- **デプロイ**: Render（`mutomosieigo.onrender.com`）
- **パッケージ管理**: npm（`npm start` で起動）

## 開発

```bash
npm start        # サーバー起動（ポート: PORT env or 3000）
```

テストフレームワーク・リントツールなし。フロントは `index.html` をブラウザで直接開いて確認。

## 科目の扱い（重要）

- **英語（科学技術英語）も他科目と完全に同等に扱う。** プロジェクト名に "Eigo" と入っているが、現在は全科目対応。英語模試の作問を `index.html` に埋め込まない。英語のテストも他科目と同じく `tests/*/data.json` として作る。
- `index.html` は全科目の目次／ランディングのみ（作問データを持たせない方向へ移行中）。

## アーキテクチャ（2026-09 リファクタ完了 / フェーズ1〜3）

「テスト追加のたびに `tests.json` 手編集」「`index.html` が4000行超の1枚岩」「なんでもモーダル（直リンク不可）」を解消する大規模リファクタリングのフェーズ1〜3が完了（詳細 spec: `docs/superpowers/specs/2026-09-10-architecture-refactor-design.md`、計画: `docs/superpowers/plans/2026-09-1*-phase*`）。

- **共有基盤:** `styles/theme.css`（テーマ変数・全コンポーネントCSS・`[hidden]`・Web フォント `@import` の唯一の定義）／`js/api.js`（`window.api`）・`js/nav.js`（`window.APP_NAV`）・`js/app-shell.js`（共通ヘッダー＋ハンバーガー＋認証ブートストラップ＋内蔵アバターピッカー）・`js/util.js`（`esc`/`tu`/`titleBadge`/`showPointToast`）。
- **コンテンツ:** `GET /api/tests` が `tests/*/data.json` を走査して索引を自動生成（`tests.json` 廃止）。全テストが `data.json`＋`quiz.html?d=…`。
- **マルチページ:** 各機能が独立 `.html`（`members`/`scores`/`clrank`/`predict`/`battle`/`race`/`login`/`admin`）。`express.static` のまま・ビルドツールなし。各ページは `theme.css`＋`api/nav/app-shell/util.js` を読み `appShell.mount({ nav: window.APP_NAV })`。認証は `appshell:auth` イベントで橋渡し。
- **`index.html`（≈1459行）:** ホーム目次（試験フォルダ一覧・ランキング・時間割カード・お知らせ）＋共通シェル＋認証（`syncUser`/`syncPasswordUser`・`manageAuth:false`）＋自前のアバター/テーマ/お知らせモーダルのみ。
- **残（任意）: フェーズ4 サーバー整理** — 科目別採点API 5本を1本化・`server.js` をルート単位に分割。

## 詳細ドキュメント（.claude/skills/）

- [project-architecture.md](.claude/skills/project-architecture.md) — 全体構造・DBテーブル・ファイル一覧
- [points-system.md](.claude/skills/points-system.md) — ポイント付与・テストページ作成ルール・KaTeX
- [battle-system.md](.claude/skills/battle-system.md) — バトルイベントDB・ステータスフロー・API
- [race-system.md](.claude/skills/race-system.md) — レースイベント・勉強時間記録・season_points
- [index-html-structure.md](.claude/skills/index-html-structure.md) — 英語模試データ層・採点ロジック
- [test-creation-workflow.md](.claude/skills/test-creation-workflow.md) — **テスト新規作成はdata.jsonのみ**（HTMLは作らない）・quiz-engine.js共通レンダラー

## テスト索引（`/api/tests`）

新しいテストの `data.json` には `year`（数値）・`grade`（数値）・`exam`（文字列）が必須。`GET /api/tests` が `tests/*/data.json` を走査してホーム画面のテスト索引を自動生成する（`tests.json` は廃止済み・手編集ファイルなし）。全テストが `data.json`＋`quiz.html?d=…` に移行済みで、per-test の `index.html` や `nekku-engine.js`・`_legacy.json` は存在しない。

## クイズ実装の3ステップ（必須）

テスト・クイズを1つ実装するときは、**いきなり作らず必ずこの順で進める**。

1. **リサーチ** — その題材・出題形式について学習科学のリサーチを行う
2. **過去文献の確認** — `research/index.json` を引き、該当する finding を実際に読む
3. **実装計画と根拠をユーザーに確認** — 「何を作るか」＋「なぜ効くか（出典付き）」を提示し、**承認を得てから実装**

前提：**復習間隔は「何日も空ける」ではなく、試験までの残り日数を基準にした短期設計にする**（`research/findings/short-term-exam-prep.json` の `optimal-gap-is-20-40-percent-of-days-left`）。

## リサーチストア（research/）

- [research/README.md](research/README.md) — スキーマと運用ルール
- [research/index.json](research/index.json) — 索引・タグ逆引き・未実装findingの一覧
- 実装したら該当 finding の `implemented_in` と `index.json` の `unimplemented` を更新する
