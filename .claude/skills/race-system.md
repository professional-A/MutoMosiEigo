---
name: race-system
description: レースイベントのDB構造・勉強時間記録・ペアボーナス・season_points
metadata:
  type: reference
---

# レースシステム

## 主要テーブル

### races
```sql
id          SERIAL PRIMARY KEY
subject     TEXT    -- 科目コード ('nekku', 'kakougaku' 等)
status      TEXT    -- 'active' | 'finished'
created_at  TIMESTAMPTZ
```

### race_pairs
```sql
id       SERIAL PRIMARY KEY
race_id  INTEGER REFERENCES races(id)
```

### race_pair_members
```sql
id       SERIAL PRIMARY KEY
pair_id  INTEGER REFERENCES race_pairs(id)
user_id  INTEGER REFERENCES users(id)
```

### race_study_log
```sql
id           SERIAL PRIMARY KEY
race_id      INTEGER REFERENCES races(id)
user_id      INTEGER REFERENCES users(id)
muto_minutes INTEGER DEFAULT 0   -- 武藤模試での学習時間
manual_minutes INTEGER DEFAULT 0  -- 手動入力（自習・参考書）
game_minutes INTEGER DEFAULT 0   -- ゲーム用（未使用）
logged_at    TIMESTAMPTZ
```

## season_points

- `users.season_points`: レース・バトルで使用するシーズンポイント
- `users.points`: 累積ポイント（lifetime）
- 管理者の全員配布 (`/api/admin/grant-all`) は両方に加算される

## ペア応援ボーナス

ペアの相手がテストでポイントを獲得すると、自分の `season_points` に 20% が加算される。  
`/api/points/add` 内でペアを検索して自動付与。

## window.QUIZ_SUBJECT との連動

`addPoints` 呼び出し時の `subject` が `races.subject` と一致するレースのみが  
season_points 計算の対象になる。科目コードを統一すること。

## 科目コード一覧

| 表示名 | コード |
|--------|--------|
| 熱流体工学Ⅰ | `nekku` |
| 加工学 | `kakougaku` |
| 英語 | `eigo` |
