# フェーズ2(2b)：`numeric` 問題タイプ追加とクイズエンジン統合 設計書

- 日付: 2026-09-10
- 状態: 設計確定
- 上位: `docs/superpowers/specs/2026-09-10-architecture-refactor-design.md`（フェーズ2「2b」）
- 実装方式: バニラJS／ビルドなし

## 背景

`quiz.html` が `data.problems` の有無で `js/quiz-engine.js`（`sections`/`qs`、`single|multi|sort|input`、ナビー系）と `js/nekku-engine.js`（`problems`、数値解答＋許容誤差、紫系、独自DOM）を出し分けている。エンジンを1本に統合し、`quiz.html` の分岐を無くす。

対象データは熱流体3ファイル（`tests/2026-4-zenki-chukan-nekku{,-kako,-kako-kai}/data.json`、計23/13/13問）。`ch`（章ラベル）は問題順と一致しない。全問が `svg`＋`hint`＋`reveal` を持つ。最大4パート。`mult` は4パート・`isAngle` は2パートのみ。`katex` フィールドは未設定だが数式多数。

## スコープ

**やる:**

- `js/quiz-engine.js` に `numeric` 問題タイプを追加（描画・許容誤差採点・`svg`/`hint`/`reveal`/`tag` 対応）。既存4タイプは不変更（追加のみ）。
- 熱流体3ファイルを `{problems:[…]}` → `{sections:[{qs:[{type:"numeric",…}]}]}` に変換。1ファイル1セクション（問題順保持）。`"katex": true` 付与。
- `quiz.html` の `data.problems` 分岐を削除（常に `quiz-engine.js` + `initQuiz`）。
- `js/nekku-engine.js` を削除。
- `tests-index.js` の `countItems` から `data.problems` 分岐を削除。
- ドキュメント更新（`test-creation-workflow.md` に `numeric`、`project-architecture.md` から `nekku-engine.js` 記述を削除）。

**やらない:**

- 2d（`quiz-engine.js` / エンジンの CSS から `:root` を撤去し `theme.css` を使う）。別サイクル。
- `nekku-engine.js` の紫系デザインの移植（テーマはナビー系に統一）。
- 既存 localStorage 進捗の移行シム（過去試験3件のため周知のみ）。
- `single|multi|sort|input` の挙動変更。

## `js/quiz-engine.js` 内部構造（参照）

- `_sections` = `data.sections`。各 `sec` は `{id, no, title, qs:[]}`。
- 問題キー: `key = `${sec.id}_${qi}``（例 `s1_0`）。`_state[key] === 1`（正解）／`-1`（不正解）／`undefined`（未回答）。
- `buildQuestion(q, qi, key, secId)`（行160付近）が `if (q.type === 'single') … else if 'multi' … 'sort' … 'input'` で分岐。ここに `else if (q.type === 'numeric')` を足す。
- `refreshQ(key, secId)` で1問だけ再描画、`save()` で localStorage＋`progressSave`、`award(key)` で `addPoints(_data.pointsPerQ || 100, _storageKey, key, true, _data.subject)`。
- `_state[`${sec.id}_${qi}`] === 1` の数でセクション／全体スコアを数える（`renderAll` / `updateScore`）。
- `typeset(el)` が KaTeX（`data.katex` 時のみロード）。

## `numeric` タイプ仕様

### データ

```json
{
  "type": "numeric",
  "tag": "第1章 · 動粘度",
  "q": "問題文（HTML+KaTeX可）",
  "svg": "<svg …>…</svg>",
  "hint": "① … \n② …",
  "reveal": ["式1", "式2", "答え"],
  "parts": [
    { "label": "μ", "unit": "Pa·s", "ans": 7.2e-4, "mult": 0.001, "angle": false }
  ]
}
```

- `tag` / `svg` / `hint` / `reveal` / `parts[].label` / `parts[].unit` / `parts[].mult` / `parts[].angle` はすべて省略可。
- `parts[].ans` は数値必須。`parts` は1個以上（0個なら採点対象なし）。
- トップレベル `pointsPerPart`（省略時 `pointsPerQ`、それも無ければ 100）をパート正解時に付与。

### 描画（`buildQuestion` の `numeric` 分岐）

DOM 構造（既存の `.q` / `.q-top` / `.qn` / `.q-body` / `.prompt` クラスを流用）:

```
.q#q_<key>
  .q-top
    .qn "Q<qi+1>"
    .q-body
      (tag があれば) <div class="num-tag">第1章 · 動粘度</div>
      (svg があれば) <div class="num-svg">…svg…</div>
      .prompt  ← q.q
      parts[] ごと:
        <div class="num-part">
          (label があれば) <span class="num-label">μ</span>
          <input class="num-input" id="ni_<key>_p<idx>" inputmode="decimal">
          (unit があれば) <span class="num-unit">Pa·s</span>
          <button onclick="numCheck('<key>','<secId>',<idx>)">確認</button>
          <span class="num-fb" id="nf_<key>_p<idx>"></span>
        </div>
      .num-actions
        (hint があれば) <button onclick="numHint('<key>')">💡 ヒント</button>
        (reveal があれば) <button onclick="numReveal('<key>')">📖 解答を見る</button>
      (hint があれば) <div class="num-hint" id="nh_<key>" hidden>…hint（改行保持）…</div>
      (reveal があれば) <div class="num-reveal" id="nr_<key>" hidden>reveal[] を <div> 区切り</div>
```

CSS は `quiz-engine.js` 内の `CSS` テンプレート文字列に `.num-*` クラスを追記（既存の `--teal` 等の変数を使用）。`num-input` は既存 `.inrow input` と同系の見た目。

### 採点（`window.numCheck(key, secId, idx)`）

```
v = parseFloat(input.value)
if (isNaN(v)) → input を赤枠にして return（_state は触らない）
if (part.mult) v = v * part.mult
ok = part.angle ? Math.abs(v - part.ans) <= 2
               : Math.abs(v - part.ans) / Math.abs(part.ans) <= 0.02
_state[`${key}_p${idx}`] = ok ? 1 : -1
fb 表示（✓ 正解 / ✗ もう一度）、input 枠色
if (ok) addPoints(pointsPerPart, _storageKey, `${key}_p${idx}`, true, _data.subject)
全 parts の `_state[`${key}_p${i}`] === 1` なら _state[key] = 1（＝この問題done）
   一部でも -1 があり全正解でないなら _state[key] = -1
save(); refreshQ(key, secId)
```

- **スコア計上は問題レベル**（`_state[key] === 1` の数）。既存 `updateScore` / セクションスコア / ホーム画面 `getProgress`（`v === 1` を数え `totalItems` ＝ 問題数でキャップ）と整合。パート単位のキーは復元と得点のための内部詳細。
- 得点は**パート単位**（4パート問題は最大 `4 × pointsPerPart`）。`addPoints` の重複排除キー `${key}_p${idx}` により再訪時の二重付与なし（既存 `points.js` の仕組み）。

### ヒント／解答（`window.numHint` / `window.numReveal`）

- `numHint(key)`: `#nh_<key>` の `hidden` をトグル。
- `numReveal(key)`: `#nr_<key>` を表示（一度開いたら閉じない、nekku 現行と同じ）。開いた事実は `_state[`${key}_revealed`] = 1` で保存し再描画時に復元。
- どちらも `_state[key]` の正誤には影響しない。

### 復元（`refreshQ` / `renderAll` 経由）

- `_state[`${key}_p${idx}`] === 1` のパートは入力欄を「✓」状態＋枠色で再描画（値は復元しない＝nekku 現行と同じ）。
- `_state[key] === 1` なら `.q.correct`。

## データ変換

各 `problems[i]` → `sections[0].qs[i]`（順序保持）:

| nekku | numeric |
|---|---|
| `no` | 破棄 |
| `ch` + `tag` | `tag: ch + " · " + tag`（`ch` 無ければ `tag` のみ、両方無ければ `tag` 省略） |
| `q` `svg` `hint` `reveal` | そのまま |
| `parts[].label` `.unit` `.ans` `.mult` | そのまま（`label` は空文字なら省略） |
| `parts[].isAngle` | `angle` に改名（`false` は省略してよい） |

トップレベル: 既存の `title` `subtitle` `storageKey` `subject` `year` `grade` `exam` を維持し、`"katex": true` を追加、`pointsPerPart`（現状 nekku_test のみ 300。他2ファイルは未設定→ `300` を明示的に付与）を維持／付与、`sections: [{ "id": "s1", "no": "01", "title": <既存 title の "・" 以降、無ければ "演習問題"> }]` を追加、`problems` キーを削除。

変換は Node スクリプト（`/tmp` に作成、コミットしない）で行い、`JSON.parse` → 加工 → `JSON.stringify(obj, null, 2)` で書き戻す（データファイルのため全体再整形を許容）。実行後、3ファイルとも人間が KaTeX（`$…$`、`reveal`/`hint` の `\n`）・SVG・`<br>` を目視確認。

## エラー処理

- `numeric` 入力が空／NaN → 赤枠のみ、採点しない。
- `parts` 空 → プロンプトのみ表示、スコア対象0。
- `tag`/`svg`/`hint`/`reveal`/`part.label`/`part.unit` 省略時は該当UIを出さない。
- 未知の `q.type` → 既存同様スキップ（`buildQuestion` は最後に `inner` を閉じて返す。未知タイプは入力UIなしで表示されるだけ）。

## 検証（テストフレームワークなし）

1. `node --check js/quiz-engine.js` → exit 0。
2. 変換後、3 `data.json` が `JSON.parse` 可能。各 `sections.length === 1`、`sections[0].qs.length` が 23/13/13、全 `qs[].type === "numeric"`、トップレベル `katex === true`、`problems` キーなし。
3. `node -e` で旧（`git show HEAD:tests/…/data.json` のうち変換前コミット）と新を突き合わせ:
   - `qs.length` === 旧 `problems.length`
   - 全 `ans` 値の多重集合が一致
   - `parts` 数の並びが一致
   - `svg` / `hint` / `reveal`（JSON文字列化）が問題ごとに一致
   - 旧 `isAngle: true` の箇所が新 `angle: true` に、旧 `mult` が保持
4. `node -e "require('./tests-index').buildTestsIndex()"` → 28件、熱流体3件の `totalItems` が 23/13/13（`sections` 経由）、警告なし。`countItems` に `problems` 分岐が無い。
5. `quiz.html` に `data.problems` 参照・`nekku-engine.js` 参照が残っていない（`grep`）。`js/nekku-engine.js` が存在しない。
6. 静的サーバー（`python3 -m http.server`）で `/quiz.html?d=tests/2026-4-zenki-chukan-nekku/data.json`:
   - ナビー系テーマ・KaTeX 数式化・SVG 表示・TOC・スコアバー・「← トップへ」
   - 相対誤差2%内→「✓ 正解」、外→「✗」、`8e-7` 形式OK
   - 角度問題（±2）・`mult` 問題が正しく採点
   - 💡ヒント／📖解答トグル、4パート問題、全パート正解で `.q.correct`
   - リロードで正解パート・reveal 状態が復元
   - コンソールエラーなし
7. `/quiz.html?d=tests/2026-9-ai-yougo/data.json`（`single` 型）が従来どおり。
8. Render デプロイ後に 6・7 を本番で。

## リスク

| リスク | 対策 |
|---|---|
| 熱流体テストの見た目が紫→ナビー | 意図的（テーマ統一）。ユーザー了承済み |
| 旧 localStorage 進捗（`nekku_test` の `{"1-0":true}` 等）が新キーと不一致 → 未着手表示 | 過去試験3件のみ。周知 |
| KaTeX 未ロードで数式が生表示 | 変換で `"katex": true` を必ず付与。検証2 |
| `JSON.stringify` 再整形で SVG 改行・KaTeX の `\\` が変質 | parse↔stringify はエスケープ保持。検証3で旧新の文字列一致を機械照合 |
| `numeric` 追加で既存4タイプが壊れる | `else if (q.type === 'numeric')` で隔離・追加のみ。検証7 |
| `pointsPerPart` 未設定の2ファイルで得点が意図と違う | 変換時に `300` を明示付与（nekku_test と揃える） |
| `quiz.html` から `nekku-engine.js` を消し忘れ | 検証5 で grep |

## 関連

- 上位: `docs/superpowers/specs/2026-09-10-architecture-refactor-design.md`
- 前提: フェーズ2a（`/api/tests`・`tests-index.js`）完了・マージ済み
- メモリ: `architecture-refactor-2026-09`
- 次: 2c（旧 `index.html` 方式の `data.json` 化）／2d（`:root` → `theme.css`）
