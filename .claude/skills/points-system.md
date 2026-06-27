---
name: points-system
description: ポイント付与・テストページ作成ルール（points.js使い方・QUIZ_SUBJECT・KaTeX）
metadata:
  type: reference
---

# ポイントシステム

## points.js の使い方

全テストページ共通。`window.QUIZ_SUBJECT` を必ず先に設定してから読み込む。

```html
<!-- テストページのヘッダー部分 -->
<script>window.QUIZ_SUBJECT = '科目名';</script>
<script src="../../js/points.js"></script>   <!-- tests/*/index.html の場合 -->
<script src="./js/points.js"></script>        <!-- ルート直下ページの場合 -->
```

## addPoints の呼び出し

```js
addPoints(amount, quizKey, questionKey, correct, subject);
// 例:
addPoints(300, 'nekku_test', `q${i}`, true, '熱流体工学Ⅰ');
addPoints(100, 'kakougaku_setugou', `q${i}`, true, '加工学');
```

- `quizKey`: ページ固有のキー（重複排除に使用）
- `questionKey`: 問題番号（`q0`, `q1` …）
- `correct`: 正解なら `true`
- `subject`: `window.QUIZ_SUBJECT` と一致させる

## ポイント単価

| 科目 | 1問正解 | 2周目以降 |
|------|---------|----------|
| 熱流体工学Ⅰ | 300pt | 60pt（20%） |
| 加工学 | 100pt | 20pt（20%） |
| 英語（英語模試） | 100pt | 20pt（20%） |

## 重複排除
`quiz_answers` テーブルで `(user_id, answer_key, subject)` をユニークキーに管理。  
同じ問題は2周目以降 20% のポイントのみ付与。

## ログインしていない場合
`points.js` は amber トーストで警告を表示し、`localStorage` に保存しない（サーバー未送信）。

## テストページ新規作成チェックリスト

1. `<script>window.QUIZ_SUBJECT='科目名';</script>` を points.js より**前**に記述
2. `<script src="../../js/points.js"></script>` を読み込む（パス確認）
3. 各問題の正解時に `addPoints(...)` を呼ぶ
4. 数式を含む場合は KaTeX を必ず使用（後述）
5. ローカルに独自の `addPoints` 関数を定義しない（server 送信できなくなる）

## KaTeX 使用ルール

数式のあるページには必ず KaTeX を使う（熱流体工学Ⅰ・物理系全般）。

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"
  onload="renderMathInElement(document.body, {delimiters:[
    {left:'$$',right:'$$',display:true},
    {left:'$',right:'$',display:false}
  ]})"></script>
```

## 熱流体工学Ⅰ 固有ルール

- 有効数字 **3桁固定** で採点・表示
- 1問 **300pt**、2周目 **60pt**
- ペア応援ボーナス: 対象者の獲得量の **20%** を season_points に加算
