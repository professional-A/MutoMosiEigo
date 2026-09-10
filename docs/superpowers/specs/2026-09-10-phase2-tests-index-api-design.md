# フェーズ2（2a）：`/api/tests` によるテスト索引の自動生成 設計書

- 日付: 2026-09-10
- 状態: 設計確定
- 上位計画: `docs/superpowers/specs/2026-09-10-architecture-refactor-design.md`（フェーズ2の一部＝「2a」のみを本 spec で扱う）
- 実装方式: マルチページ／ビルドなし／`express.static('.')` のまま

## 背景

「新しいテストを追加するたびに `tests.json` を手編集する」を廃止する。現状 `tests.json` は実データとズレている:

- **死んだエントリ3件**（指すディレクトリ／ファイルが存在しない）:
  - `加工学 ・ 中間試験風テスト`（`tests/2026-4-zenki-chukan-kakougaku-chukan/` 無し、`storageKey: kakougaku_chukan_v1`）
  - `制御工学Ⅰ ・ まとめノート`（`tests/2026-4-zenki-chukan-seigyogaku-summary/` 無し、`type: summary`）
  - `熱流体工学Ⅰ ・ 公式集`（`nekku/formula.html` 無し＝`nekku/` は空、`type: summary`）
- **`path` の不整合**: 加工学7件・制御工学5件は `path: "tests/xxx/"`（末尾スラッシュのディレクトリ）だが、中身は `data.json` のみで `index.html` が無い → `express.static` がディレクトリ index を返せず**リンク切れ**。正しくは `/quiz.html?d=tests/xxx/data.json`。
- `totalItems` が data.json の実問題数からズレる可能性（内容修正時に追従しないため）。

## スコープ

**やる:**

- `server.js` に `GET /api/tests` を追加。リクエストごとに `tests/` を走査して索引配列を返す。
- 旧 `index.html` 方式7件のメタ情報を `tests/_legacy.json` に集約し、走査結果へ連結。
- 既存 `data.json` 21ファイルに `year` / `grade` / `exam` を追記。
- `index.html` の `fetch('tests.json')` 3か所を `fetch('/api/tests')` に置換。
- `tests.json` を削除。
- `test-creation-workflow.md`（`.claude/skills/`）と CLAUDE.md に `year`/`grade`/`exam` 必須を追記。

**やらない（後フェーズ）:**

- クイズエンジン統合（2b）、旧 `index.html` の `data.json` 化（2c）、`quiz-engine.js`/`nekku-engine.js` の `:root` 撤去（2d）。
- `index.html` の `renderGroups` / `applyExamArchive` / `archiveAllTests` / 固定科目リストのマージ等のロジック変更。
- アーカイブ判定のサーバー移動（現状の client 側 `applyExamArchive` のまま）。
- `exam_schedule` テーブル・`/api/exam-schedule` の変更。
- 認証（`/api/tests` は現 `tests.json` と同じく公開）。
- キャッシュ最適化（走査は毎リクエスト。対象は約28個の小 JSON で無視できるコスト。YAGNI）。

## 現状データ（2026-09-10 時点）

`tests.json` エントリ 31件の内訳:

| 種別 | 件数 | 例 |
|---|---|---|
| `data.json` 方式（`tests/*/data.json` 実在）→ `/api/tests` が走査で拾う | 21 | 加工学7・制御工学5・熱流体3・AI4・電気電子2 |
| 旧 `index.html` 方式（`tests/*/index.html` 実在）→ `_legacy.json` へ | 7 | eigo, step1〜4, handout, saishiken |
| 死んだエントリ（実体なし・本 spec で消える） | 3 | `加工学 中間試験風テスト` / `制御工学Ⅰ まとめノート`(summary) / `熱流体工学Ⅰ 公式集`(summary, `nekku/formula.html`) |
| 合計 | 31 | → `/api/tests` は 28 件を返す |

`data.json` を持つディレクトリ（`year`/`grade`/`exam` 追記対象・21件）:

```
tests/2026-4-zenki-chukan-kakougaku-{kakunin,chuzou,chuzou-oyo,sosei,sosei-oyo,setugou,setugou-oyo}/
tests/2026-4-zenki-chukan-nekku/  tests/2026-4-zenki-chukan-nekku-kako/  tests/2026-4-zenki-chukan-nekku-kako-kai/
tests/2026-4-zenki-chukan-seigyogaku/  tests/2026-4-zenki-chukan-seigyogaku-vocab/
tests/2026-4-zenki-chukan-seigyogaku-block-laplace/
tests/2026-4-zenki-chukan-seigyogaku-kakomon2025/  tests/2026-4-zenki-chukan-seigyogaku-kakomon2025-ruiji/
tests/2026-9-denki-tangen-form/  tests/2026-9-denki-tangen-slide/
tests/2026-9-ai-yougo/  tests/2026-9-ai-ichimon/  tests/2026-9-ai-kakomon/  tests/2026-9-ai-ruiji/
```

各ディレクトリの `year`/`grade`/`exam`/`subject`/`storageKey` の正しい値は、削除前の `tests.json`（`git show HEAD:tests.json`）の対応エントリからそのまま取る。`path` は照合には使わない（`/api/tests` が生成する）。

## コンポーネント

### `GET /api/tests`（`server.js`）

`app.use(express.static('.'))`（現1684行付近）**より前**に登録する。

処理:

1. `fs.readdirSync(path.join(__dirname, 'tests'), { withFileTypes: true })` でサブディレクトリ一覧。
2. 各ディレクトリ `d` について `tests/d/data.json` が存在すれば:
   - `JSON.parse(fs.readFileSync(...))`。失敗したら `console.warn('[api/tests] skip ' + d + ': ' + e.message)` して**そのディレクトリはスキップ**。
   - エントリを組み立てる:
     ```
     {
       year:       data.year,
       grade:      data.grade,
       exam:       data.exam,
       subject:    data.subject,
       title:      data.title,
       storageKey: data.storageKey ?? null,
       totalItems: sum(data.sections?.[i].qs?.length)  // 無ければ 0
       type:       data.type,        // 無ければ undefined（JSON では省略）
       path:       "/quiz.html?d=tests/" + d + "/data.json"
     }
     ```
   - `year`/`grade`/`exam`/`subject`/`title` のいずれかが欠けていたら `console.warn`（値は欠けたまま返す）。
3. `tests/_legacy.json` を読む。存在しない／パース失敗なら `console.warn` して空配列。中身の各要素はそのまま索引に連結（構造は現 `tests.json` エントリと同一：`{year,grade,exam,subject,title?,storageKey,totalItems,path,type?}`）。
4. `data.json` 由来 ＋ `_legacy.json` 由来を結合した配列を `res.json(...)` で返す。並び順は問わない（`index.html` 側が `year`/`subject`/`exam` でグループ化・ソートする）。
5. `tests/` 自体が `readdir` できない等の予期せぬ例外 → `res.status(500).json({ error: String(e) })`。

`totalItems` 算出はヘルパ関数に切り出す:
```js
function countItems(data) {
  if (!Array.isArray(data.sections)) return 0;
  return data.sections.reduce((s, sec) => s + (Array.isArray(sec.qs) ? sec.qs.length : 0), 0);
}
```

### `tests/_legacy.json`（新規）

削除前 `tests.json` から旧 `index.html` 方式7件をそのままコピーした配列:

```
科学技術英語Ⅰ / 前期中間試験 / (title なし) / tests/2026-4-zenki-chukan-eigo/       / mutou_u12         / 121
科学技術英語Ⅰ / 再試験       / 単語 (Step 1)  / tests/2026-4-zenki-chukan-step1/      / vocab_known_u12   / 60
科学技術英語Ⅰ / 再試験       / 熟語 (Step 2)  / tests/2026-4-zenki-chukan-step2/      / idiom_known_u12   / 26
科学技術英語Ⅰ / 前期中間試験 / 文法 (Step 3)  / tests/2026-4-zenki-chukan-step3/      / gram3_known       / 31
科学技術英語Ⅰ / 前期中間試験 / ハンドアウト演習 / tests/2026-4-zenki-chukan-handout/  / mutou_handout_u12 / 19
科学技術英語Ⅰ / 再試験       / 軽い総合演習    / tests/2026-4-zenki-chukan-saishiken/ / mutou_saishiken   / 29
科学技術英語Ⅰ / 前期中間試験 / 本文理解 (Step 4) / tests/2026-4-zenki-chukan-step4/   / mutou_step4       / 45
```

（正確な JSON は削除前 `tests.json` の該当7エントリをそのまま貼る。`year:2026, grade:4` 共通。）

2c で1件を `data.json` 化するたびに、この配列から該当要素を削除する。全て消えたら `_legacy.json` ごと削除し、`/api/tests` の `_legacy.json` 読み込みは「無ければ空配列」で吸収される。

### `data.json`（21ファイル・追記）

各ファイルのトップレベルに3フィールドを追加（既存の `subject` の近くが読みやすい）:

```json
"year": 2026,
"grade": 4,
"exam": "前期末試験",
```

値の対応（削除前 `tests.json` より）:

| ディレクトリ群 | year | grade | exam |
|---|---|---|---|
| `kakougaku-*`（7） | 2026 | 4 | 前期中間試験 |
| `nekku`, `nekku-kako`, `nekku-kako-kai` | 2026 | 4 | 前期中間試験 |
| `seigyogaku`, `seigyogaku-vocab`, `seigyogaku-block-laplace` | 2026 | 4 | 前期中間試験 |
| `seigyogaku-kakomon2025`, `seigyogaku-kakomon2025-ruiji` | **2025** | 4 | 前期中間試験 |
| `denki-tangen-form`, `denki-tangen-slide` | 2026 | 4 | 単元テスト |
| `ai-yougo`, `ai-ichimon`, `ai-kakomon`, `ai-ruiji` | 2026 | 4 | 前期末試験 |

### `index.html`（3か所置換）

- 行1417付近 `const data = await fetch('tests.json').then(r => r.json());` → `fetch('/api/tests')`
- 行1463付近 同上 → `fetch('/api/tests')`
- 行1680付近 `fetch("tests.json")` → `fetch("/api/tests")`

エラー時メッセージ（`tests.json が存在するか確認…`）は文言を `テスト索引 (/api/tests) の読み込みに失敗しました` 程度に更新（任意・軽微）。それ以外のロジックは不変更。

### `tests.json`（削除）

`git rm tests.json`。削除前に `git show HEAD:tests.json` の内容を `_legacy.json` 作成と data.json 追記の参照元として使う。

### ドキュメント追記

- `.claude/skills/test-creation-workflow.md` の `data.json` スキーマ表に `year`（数値）/ `grade`（数値）/ `exam`（文字列）を「必須」で追加。「`index.html` にリンクを追加する場合は…」の記述を「`/api/tests` が自動で拾うのでリンク追記は不要」に更新。
- `CLAUDE.md` の該当箇所（テスト作成の記述）に `year`/`grade`/`exam` 必須を1行追記。

## データフロー

```
ブラウザ /  → index.html
  loadExamSchedule() → GET /api/exam-schedule → _examSchedule[subject||exam] = archive_after   （不変更）
  fetch('/api/tests') → server.js:
      tests/ を readdir
        d/data.json あり → parse → {year,grade,exam,subject,title,storageKey,totalItems,type?,path=/quiz.html?d=...}
        d/data.json なし → skip
      + tests/_legacy.json（旧7件）
      → JSON 配列
  tests = 配列
  applyExamArchive()  → today >= archive_after の (subject,exam) に t.archived=true   （不変更）
  renderGroups()      → year/grade グループ・subject カード・progress バー            （不変更）
```

## エラー処理

| 事象 | 挙動 |
|---|---|
| ある `data.json` がパース不能 | そのディレクトリのみスキップ、`console.warn`、他は返す、ステータス 200 |
| `data.json` に `year`/`grade`/`exam`/`subject`/`title` が欠落 | 欠けたまま返す、`console.warn`。移行で全 data.json に入れるのが前提 |
| `tests/_legacy.json` が無い／壊れている | 空配列扱いで続行、`console.warn` |
| `tests/` を `readdir` できない | 500 + `{error}`。`index.html` の既存 `.catch` が「読み込めませんでした」を表示 |
| `/api/tests` に認証 | 不要（公開） |

## 検証（テストフレームワークなし）

`npm start`（DB env 必要）が使える環境で:

1. `curl -s localhost:3000/api/tests | jq 'length'` → 28（31 − 死んだ3。旧7件 + data.json 21件）。
2. `curl -s localhost:3000/api/tests | jq -S '[.[].storageKey]|sort'` を削除前 `tests.json` の同抽出（死んだ3を除外）と照合 → 一致。
3. `jq '.[] | select(.subject=="加工学") | .path'` → すべて `"/quiz.html?d=tests/…/data.json"` 形式（旧 `tests/…/` ではない）。
4. `jq '.[] | select(.storageKey=="ai_ichimon_v1") | .totalItems'` を `tests/2026-9-ai-ichimon/data.json` の実問題数（`jq '[.sections[].qs|length]|add'`）と照合 → 一致。
5. `tests/2026-9-ai-yougo/data.json` を一時的に壊す → `/api/tests` は 200 かつその1件だけ欠落、`console.warn` にディレクトリ名 → 元に戻す。
6. ブラウザ `/` → カード一覧・科目グループ・年度学年見出し（`2025年度` の過去問含む）・進捗バーが従来と一致。アーカイブトグル、管理モーダルの「日程管理」で subject×exam ペアが従来どおり出る。
7. `tests/9999-9-dummy/data.json`（`year/grade/exam/subject/title/storageKey/sections` 入り）を作成 → サーバー再起動 → `/api/tests` と `/` に出現（`tests.json` 未編集）→ ダミー削除。
8. Render デプロイ後、本番 `/api/tests` と `/` で 1〜6 相当を確認。

## リスク

| リスク | 対策 |
|---|---|
| `data.json` への `year/grade/exam` 追記漏れ → `undefined年度` 見出し | 移行を21ファイル一括で行い、検証6でグループ見出しを目視。`console.warn` も保険 |
| `_legacy.json` の値写し間違い | 削除前 `tests.json` から**該当行をそのままコピー**（打ち直さない） |
| `totalItems` 算出が旧 `tests.json` と不一致 → 進捗バー％が変わる | 期待挙動（data.json の実数が正）。検証4で1件突き合わせ、検証6で見た目確認 |
| `express.static` より後に `/api/tests` を置くと静的解決が優先され 404 | ルート登録を `app.use(express.static('.'))` の**前**に必ず置く（既存の他 `/api/*` と同じ位置） |
| 加工学・制御工学の `path` 変更で既存 localStorage 進捗が引き継がれない | `storageKey` は不変（data.json のものを使う）。進捗は `storageKey` 依存なので影響なし |

## 関連

- 上位: `docs/superpowers/specs/2026-09-10-architecture-refactor-design.md`
- メモリ: `architecture-refactor-2026-09`
- フェーズ1（完了・マージ済み）: `docs/superpowers/plans/2026-09-10-phase1-shared-foundation.md`
