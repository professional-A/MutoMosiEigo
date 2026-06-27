---
name: test-creation-workflow
description: 新しいテストページの作成方法（data.jsonのみ、HTMLは不要）
metadata:
  type: reference
---

# テスト作成ワークフロー（2026-06-27以降）

## 原則

**テストページごとにHTMLを作成しない。** `data.json` だけ作れば完結する。

## 新しいテストを作るとき

1. フォルダを作る: `tests/YYYY-M-テスト名/`（**科目に関わらず全テストを `tests/` に置く**）
2. `data.json` を作る（スキーマは下記）
3. `index.html` にリンクを追加する場合は `/quiz.html?d=tests/YYYY-M-テスト名/data.json`

`index.html` は**作成しない**。URLは `/quiz.html?d=...` を直接使う。

### フォルダ命名規則

```
tests/YYYY-M-{試験種別}-{科目}-{テスト種別}/
例:
  tests/2026-4-zenki-chukan-nekku/          ← nekku 中間試験対策
  tests/2026-4-zenki-chukan-nekku-kako/     ← nekku 過去問
  tests/2026-4-zenki-chukan-kakougaku-sosei/ ← 加工学 組成
```

nekku 系も含め、**すべてのテストデータは `tests/` に集約する**。`nekku/` フォルダはリダイレクトスタブと公式集のみ。

## data.json スキーマ

```json
{
  "title": "テストタイトル",
  "subtitle": "サブタイトル（省略可）",
  "eyebrow": "科目名 ・ テスト種別",
  "description": "テストの説明文",
  "subject": "科目名",
  "storageKey": "unique_storage_key_v1",
  "pointsPerQ": 100,
  "katex": false,
  "tip": "使い方の説明文（<b>使い方：</b>の後の部分）",
  "footer": "フッターテキスト",
  "sections": [
    {
      "id": "s1",
      "no": "01",
      "title": "セクション名",
      "qs": [
        {
          "type": "single",
          "q": "問題文",
          "opts": ["選択肢A", "選択肢B", "選択肢C"],
          "ans": "選択肢A",
          "note": "解説文"
        }
      ]
    }
  ]
}
```

## 問題タイプ

| type | 必須フィールド | 説明 |
|------|--------------|------|
| `single` | `opts[]`, `ans` | 単一選択（タップで即採点） |
| `multi` | `opts[]`, `ans[]` | 複数選択（全部選んで採点ボタン） |
| `sort` | `items[]`, `ans[]` | 並べ替え（選んで順番を決める） |
| `input` | `ans` (文字列or配列), `hint?` | テキスト入力（Enter or 採点ボタン） |

## KaTeX使用時

`"katex": true` にすると KaTeX を自動ロード。  
数式は `$inline$` または `$$display$$` で書く。

## ポイント設定

- `pointsPerQ`: 1問正解あたりのポイント（デフォルト100）
- `subject`: `window.QUIZ_SUBJECT` に使われ、season_points計算に影響
- `storageKey`: localStorage のキー兼 quiz_answers の重複排除キー

## 共有エンジンの仕組み

```
/quiz.html?d=tests/xxx/data.json
    ↓ fetch('/tests/xxx/data.json')
    ↓ initQuiz(data)  [/js/quiz-engine.js]
    ↓ CSS注入 → DOM構築 → renderAll() → supabase/points.js/progress.js ロード
```

## 既存テストの変換スクリプト

```bash
node scripts/convert-quiz-html.js
```

変換対象は `TARGETS` 配列で指定。変換済みのものはスキップ。

## 変換できないページ（HTMLのまま）

- `tests/2026-4-zenki-chukan-kakougaku-chukan/` — カスタム試験形式（テーブル入力）
- `tests/2026-4-zenki-chukan-seigyogaku-summary/` — まとめノート形式
- `tests/2026-4-zenki-chukan-step1〜4/` — フラッシュカード+クイズ形式（別デザイン）
- `tests/2026-4-zenki-chukan-eigo/` 等 — 英語模試系
