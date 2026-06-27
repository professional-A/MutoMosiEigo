---
name: project-architecture
description: 武藤模試プロジェクト全体構造・主要ファイル・DB・API概要
metadata:
  type: reference
---

# 武藤模試 — プロジェクト構造

## スタック
- **ランタイム**: Node.js + Express (`server.js`)
- **DB**: Supabase PostgreSQL (`pool` = pg.Pool)
- **デプロイ**: Render (`mutomosieigo.onrender.com`)
- **フロント**: バニラ JS、ビルドツールなし
- **認証**: 自前セッショントークン (`session_token` in users) + Supabase JWT 併用

## 主要ファイル

| ファイル | 役割 |
|----------|------|
| `server.js` | Express API サーバー、DB初期化、全エンドポイント |
| `index.html` | メインフロント（英語模試 + 管理者UI + レース + バトル） |
| `nekku_test.html` | 熱流体工学Ⅰ 中間試験対策テスト（23問） |
| `nekku_kako.html` | 熱流体 前期中間 過去問（13問） |
| `nekku_kako_kai.html` | 熱流体 前期中間 改変版 |
| `js/points.js` | 共有ポイント送信スクリプト（全テストページから読み込む） |
| `js/progress.js` | 進捗管理 |
| `tests/*/index.html` | 科目別過去問テストページ群 |

## テストページのパス規則
- ルート直下ページ → `<script src="./js/points.js">`
- `tests/*/` サブディレクトリ → `<script src="../../js/points.js">`

## 主要DBテーブル

| テーブル | 内容 |
|----------|------|
| `users` | ユーザー情報・ポイント・成績スコア |
| `battles` | バトルイベント |
| `battle_bets` | バトルへの賭け |
| `races` | レースイベント |
| `race_study_log` | 勉強時間記録 |
| `race_pair_members` / `race_pairs` | ペア情報 |
| `quiz_answers` | 解答済み問題の重複排除用 |

## ポイント種別
- `points`（lifetime）: 累積、減らない
- `season_points`: レース用、バトル・レースで使用・還元
- `test_bet`: 英語テスト賭け額（points から別管理）

## 管理者判定
```js
req.user.email !== 'kabu6113450@gmail.com'
```
