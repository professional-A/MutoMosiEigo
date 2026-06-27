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

## 詳細ドキュメント（.claude/skills/）

- [project-architecture.md](.claude/skills/project-architecture.md) — 全体構造・DBテーブル・ファイル一覧
- [points-system.md](.claude/skills/points-system.md) — ポイント付与・テストページ作成ルール・KaTeX
- [battle-system.md](.claude/skills/battle-system.md) — バトルイベントDB・ステータスフロー・API
- [race-system.md](.claude/skills/race-system.md) — レースイベント・勉強時間記録・season_points
- [index-html-structure.md](.claude/skills/index-html-structure.md) — 英語模試データ層・採点ロジック
- [test-creation-workflow.md](.claude/skills/test-creation-workflow.md) — **テスト新規作成はdata.jsonのみ**（HTMLは作らない）・quiz-engine.js共通レンダラー
