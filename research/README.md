# research/ — 学習科学リサーチの構造化ストア

武藤模試の設計判断の根拠を、機械可読な形で貯める場所。

## 使い方

- `index.json` — 全体の索引。ドキュメント一覧、タグ → finding ID の逆引き、未実装 finding の一覧。
- `findings/*.json` — 知見1件 = 1レコードの配列。
- 長文の元リサーチ（読み物）は `../武藤模試v2 開発のための2大テーマ・ディープリサーチ.md` に残す。`findings` はそこから抽出した「使える形」。

## finding のスキーマ

```jsonc
{
  "id": "kebab-case-の一意ID",
  "claim": "1文の主張",
  "numbers": { "任意のキー": "具体的な数値。ここが実装の判断材料になる" },
  "strength": "high | moderate | low | practice",  // practice = 実務慣行でありエビデンスではない
  "sources": [{ "cite": "著者 (年) 誌名", "url": "..." }],
  "applies_to": ["vocab", "grammar", "procedure", "concept", "all"],
  "implication": "武藤模試で具体的に何をすべきか",
  "caveat": "効かない条件・注意点（必ず書く）",
  "implemented_in": ["実装済みの場所。未実装なら空配列"],
  "tags": ["..."]
}
```

## ルール

1. **`caveat` を空にしない。** 「どこまで主張してよいか」を持たない知見は使えない。
2. **`implemented_in` を更新する。** 実装したらここにファイル/機能名を書く。空のままの finding は「まだ活かせていない根拠」として `index.json` の `unimplemented` に出る。
3. `strength` が `practice` のものをエビデンスとしてユーザーに提示しない。
4. クイズを実装するときは [CLAUDE.md](../CLAUDE.md) の3ステップに従い、着手前に必ずここを読んで該当 finding を引用する。
