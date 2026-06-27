---
name: battle-system
description: バトルイベントのDB構造・ステータスフロー・管理者操作・APIエンドポイント
metadata:
  type: reference
---

# バトルシステム

## DBスキーマ（battles テーブル）

```sql
id            SERIAL PRIMARY KEY
subject       TEXT           -- 科目コード (例: 'nekku')
p1_id         INTEGER        -- NULL可（ユーザー紐づけなしの場合）
p2_id         INTEGER        -- NULL可
p1_name       TEXT           -- 名前直接入力（p1_id がない場合のみ使用）
p2_name       TEXT
winner_label  TEXT           -- 名前ベースの決着時に使用
race_id       INTEGER        -- NULL可
status        TEXT DEFAULT 'open'  -- 'open' | 'closed' | 'settled'
created_at    TIMESTAMPTZ
```

## battle_bets テーブル

```sql
id          SERIAL PRIMARY KEY
battle_id   INTEGER REFERENCES battles(id)
user_id     INTEGER REFERENCES users(id)
side        INTEGER  -- 1 または 2
amount      INTEGER
created_at  TIMESTAMPTZ
```

## ステータスフロー

```
open → (バトル終了) → closed → (手動決着 or バトル決着) → settled
```

- `open`: 賭け受付中。賭け額変更可。
- `closed`: 賭け締め切り。結果待ち。賭け変更不可。
- `settled`: 決着済み。勝者に払い戻し。

## 名前表示のSQL（GET /api/battles）

```sql
SELECT b.*,
  COALESCE(u1.username, b.p1_name) AS p1_name,
  COALESCE(u2.username, b.p2_name) AS p2_name,
  COALESCE(uw.username, b.winner_label) AS winner_name
FROM battles b
LEFT JOIN users u1 ON b.p1_id = u1.id
LEFT JOIN users u2 ON b.p2_id = u2.id
LEFT JOIN users uw ON b.winner_id = uw.id
```

## 管理者操作フロー

1. **⚔️ バトル作成**: 既存の open バトルを削除してリセット（ペアは手動追加）
2. **➕ ペア追加**: 科目コード・名前1・名前2 を入力、名前直接挿入
3. **🔒 バトル終了**: `status='open'→'closed'`（賭け締め切り）
4. **🎯 手動決着**: バトルID・スコア1・スコア2 を入力、高スコア側が勝者
5. **🏆 バトル決着**: 成績テーブルから自動的に勝敗判定（status='closed'のバトル対象）
6. **💸 全返金**: open/closed のバトルを全て賭け返金して削除

## APIエンドポイント

| メソッド | パス | 内容 |
|----------|------|------|
| GET | `/api/battles` | バトル一覧（bet集計含む） |
| POST | `/api/battles/:id/bet` | 賭け（open のみ受付） |
| POST | `/api/admin/battles/create` | バトルリセット（open削除） |
| POST | `/api/admin/battles/add-pair` | ペア追加（名前直接） |
| POST | `/api/admin/battles/close` | バトル終了（open→closed） |
| POST | `/api/admin/battles/settle` | バトル決着（成績自動） |
| POST | `/api/admin/battles/settle-manual` | 手動決着（スコア入力） |
| POST | `/api/admin/battles/refund-all` | 全返金 |

## ペア追加リクエスト例

```json
POST /api/admin/battles/add-pair
{
  "username1": "ひろと",
  "username2": "まさと",
  "subject": "nekku",
  "race_id": null
}
```

サーバー側で users テーブルを検索せず、`p1_name`/`p2_name` に直接挿入。

## 手動決着リクエスト例

```json
POST /api/admin/battles/settle-manual
{
  "battleId": 42,
  "score1": 85,
  "score2": 72
}
```

`p1_id` が null の場合は `winner_label` に p1_name/p2_name を設定。
