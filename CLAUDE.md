# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

「武藤模試」— 大学の科学技術英語Ⅰ Unit 1 & 2 用の対話型自習ツール。ビルドツール・依存ライブラリなし。`index.html` 一ファイルだけで完結している。

## 確認・開発方法

```bash
# ブラウザで直接開く（サーバー不要）
open index.html
```

テストフレームワーク・リントツールは存在しない。動作確認はブラウザで直接 `index.html` を開くだけでよい。

## アーキテクチャ

`index.html` 内に CSS・JavaScript・問題データがすべて含まれる。

**データ層**（ファイル上部の `const` 宣言群）

| 変数 | 内容 |
|------|------|
| `VOCAB1` / `VOCAB2` | Unit 1・2 の語彙問題（定義→単語の入力式） |
| `WORDCHOICE` | 日本語ヒント付き Word Choice（選択式） |
| `KEYPHRASE` | Exercises — Key Phrases（選択式） |
| `INDEPTH` | In-Depth Review（選択式） |
| `WRITING` | Writing Strategy 並べ替え（入力式） |
| `TF` | T/F Questions（True/False 選択） |
| `QA` | 本文 Q&A（選択式） |

**ロジック**

- `state` オブジェクトで解答状況を管理し、`localStorage`（キー: `mutou_u12`）に自動保存。
- `norm(s)` — 入力の正規化（大小文字・前後空白・句読点を吸収）。入力式問題の採点に使用。
- `pickOpt()` — 選択式問題の採点・UI 更新。
- `checkInput()` / `revealInput()` — 入力式問題の採点・答え表示。
- `render()` — `SECTIONS` 配列を走査してDOM全体を再描画。問題追加・変更時はここが起点。
- `updateScore()` — スコアバーとセクション別スコアを更新。

**レンダリング**

`SECTIONS` 配列に `{id, no, title, desc, type, data}` を追加するだけで新しいセクションが自動的に目次(TOC)と本文に追加される。

## 問題を追加・変更するとき

- **語彙追加**: `VOCAB1` または `VOCAB2` に `["定義", "answer"]` を追加。
- **選択式追加**: 対応するデータ配列に `{u, sen/q/s, opts, ans, note}` を追加。
- **並べ替え追加**: `WRITING` に `{u, jp, pre, post, bank, ans}` を追加（`ans` は並べ替え部分のみ）。
- **採点ロジック変更**: `norm()` 関数を編集（`checkInput` と `pickOpt` の両方に影響）。
