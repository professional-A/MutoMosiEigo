# データレポート基盤 ＋ 科目別成績・クラス順位の前期末仕様化

**作成 2026-09-18（Opus）／実装 Sonnet／前期末試験は 9/11〜9/17 に終了済み**

## 利用者の要望（原文）

> テスト終わったので／既存の全クイズをアーカイブして／時間割もなくす／
> 科目別成績とクラス順位を前期末仕様に変えたいんだけど／
> これからは仕様変更時にデータレポートとしてハンバーガーメニューに入れて歴代のデータとしてためていきたいの

## いちばん大事な順序

**いま `users` の得点列に入っているのは前期中間の点数。** 前期末の点数はこれから入力する。
前期末仕様に切り替えると同じ列を上書きしていくので、**先に前期中間をレポートとして固める。**

1. フェーズ1：データレポート基盤（保存・一覧・詳細・☰メニュー）
2. 利用者が管理画面から **「2026 前期中間試験」のレポートを作成**（人手の操作）
3. 利用者が管理画面から **得点のリセット**（前期中間の値を消して前期末の入力を空から始める）
4. フェーズ2：科目別成績・クラス順位を前期末仕様へ（7科目）
5. 利用者が前期末の点数を入力していく
6. フェーズ3：ホームから時間割を外す（**シードの削除を含む**）

**2 と 3 が終わるまでフェーズ2をデプロイしない。** 順序を逆にすると前期中間の記録が消える。

### 前期中間の科目（＝いま `scores.html` に並んでいる6列。これが正）

| # | 表示 | 得点列 | 備考 |
|---|---|---|---|
| 1 | 📘 英語 | **`test_score`** | 前期中間の英語はこの列。テスト予測と共用 |
| 2 | ⚡ 応用物理 | `ouri_score` | |
| 3 | 📐 応用数学 | `math_score` | |
| 4 | ⚙️ 加工学 | `kakougaku_score` | |
| 5 | 🔥 熱流体 | `nekku_score` | |
| 6 | 🎛️ 制御工学 | `seigyo_score` | |

**前期中間のレポートには、この6科目を `test_score` 込みで焼き付ける。**
（前期末では英語が `eigo_score` に移るので、`test_score` には前期中間の英語が残り続ける）

### 前期末の科目（時間割で確定・これが正）

| # | 科目 | 日程 | 担当 | 得点列 |
|---|---|---|---|---|
| 1 | 応用数学 | 9/11 | 奥村、降旗 | `math_score` |
| 2 | 人工知能概論 | 9/14 | ユーハラシェット | **`ai_score`（新規）** |
| 3 | 加工学 | 9/14 | 堀川 | `kakougaku_score` |
| 4 | 応用物理Ⅱ | 9/15 | 松井 | `ouri_score` |
| 5 | 熱流体工学Ⅰ | 9/15 | 阿部（晶） | `nekku_score` |
| 6 | 制御工学Ⅰ | 9/16 | 森川 | `seigyo_score` |
| 7 | 科学技術英語Ⅰ | 9/17 | 鈴木 | **`eigo_score`（新規）** |

- **前期末の英語に `test_score` を流用しない。** テスト予測・賞金分配・ワースト賞で使っている別物で、
  さらに前期中間の英語の点が入ったまま残るため。前期末の英語は `eigo_score` を新設する
- 表記ゆれに注意：時間割は「応用物理Ⅱ」、`tests/` の `subject` とホームのボタンは「応用物理」。
  **成績ページの表示名は時間割に合わせて「応用物理Ⅱ」にする**

---

## 現状の把握（調査済み・前提にしてよい）

### アーカイブは既に自前でできる（**Sonnet は触らない**）
- `admin.html` の「日程管理」に **「📦 全部アーカイブ」**（`archiveAllTests()`）がある
- `/api/tests` の全 (subject, exam) 組に `archive_after = 今日` を保存する
- `index.html` の `applyExamArchive()` が `today >= archive_after` の組に `t.archived = true` を付け、
  「📦 アーカイブを表示」トグルで隠す／出すを切り替える
- **したがって「既存の全クイズをアーカイブ」は利用者がボタンを押せば済む。実装不要。**

### 科目別成績（`scores.html` ＋ `/api/scores`）
- 得点は `users` テーブルの**科目ごとの固定カラム**：
  `test_score`（テスト予測と共用）, `ouri_score`(応用物理), `math_score`(応用数学),
  `kakougaku_score`(加工学), `nekku_score`(熱流体), `seigyo_score`(制御)
- 入力は `POST /api/score/:subject`、`SCORE_COL` で列名に対応（server.js:528）
- `scores.html` は科目ボタンも列も**ベタ書き**。`seigyoActive` のような日付分岐まで埋め込まれている
- **前期末は7科目**（応用数学・人工知能概論・加工学・応用物理Ⅱ・熱流体工学Ⅰ・制御工学Ⅰ・科学技術英語Ⅰ）。
  人工知能概論と科学技術英語Ⅰに対応する列が無い

### クラス順位（`clrank.html` ＋ `/api/class-rank`）
- 満点は「入力済み教科数 × 100」を server 側で自動算出（server.js:562-576）。**6科目ベタ書き**
- `USER_CLRANK_MAP` でアプリのユーザー名 → コマ名を対応させ、
  **5科目（test/ouri/math/kakougaku/nekku）が全部埋まっている人だけ**確定点に自動反映（server.js:585）。
  制御が抜けている＝前期中間の名残

### 時間割
- `exam_timetable` テーブル（server.js:97〜）。起動時に**前期末の7件をシード**（server.js:114-122）
- `GET /api/exam-timetable` ／ 管理は `POST /api/admin/exam-timetable`・`DELETE /api/admin/exam-timetable/:id`
- ホームの表示は `index.html` の `#timetable-card`（575行付近）と `loadTimetable()`／`toggleTimetable()`

---

## フェーズ1：データレポート基盤

### 目的

**仕様を変えるたびに、その時点のデータを固めて残す。**
過去のレポートは消さずに積み上げ、☰メニューからいつでも見られるようにする。

### DB

`server.js` の起動時マイグレーション（`ALTER TABLE ... IF NOT EXISTS` が並んでいる箇所）に追加：

```sql
CREATE TABLE IF NOT EXISTS data_reports (
  id         SERIAL PRIMARY KEY,
  slug       TEXT UNIQUE NOT NULL,     -- 例 2026-zenki-matsu
  title      TEXT NOT NULL,            -- 例 2026年度 前期末試験
  exam       TEXT,                     -- 例 前期末試験
  note       TEXT,                     -- 任意のメモ
  payload    JSONB NOT NULL,           -- スナップショット本体
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### payload に入れるもの（スナップショット）

```json
{
  "generatedAt": "2026-09-18T12:00:00Z",
  "exam": "前期末試験",
  "subjects": [ { "key": "math", "label": "応用数学", "column": "math_score" } ],
  "scores":   [ { "username": "...", "avatar": "...", "title": "...",
                  "byKey": { "math": 72 }, "total": 410, "avg": 68.3 } ],
  "classRank": { "positions": {}, "confirmed": {}, "maxScore": 600 },
  "timetable": [ { "subject": "...", "exam_date": "...", "start_time": "...",
                   "end_time": "...", "teacher": "..." } ],
  "tests":    [ { "subject": "...", "exam": "...", "title": "...", "totalItems": 116 } ],
  "stats":    { "userCount": 12, "testCount": 25, "questionCount": 1234 }
}
```

- `scores` は `/api/scores` と同じ取り方。**その時点の生の値をそのまま焼き付ける**
- `tests` は `buildTestsIndex()` を呼んで作る（`require('./tests-index')` は server.js で既に使われている）
- **個人の得点は既にサイト内で全員に見えているので、レポートでも同じ範囲に留める。**
  メールアドレス・パスワード・トークンの類は絶対に入れない

### API

| メソッド | パス | 認証 | 内容 |
|---|---|---|---|
| `GET` | `/api/data-reports` | なし | 一覧（id, slug, title, exam, note, created_at のみ。payload は返さない） |
| `GET` | `/api/data-reports/:slug` | なし | 1件（payload 込み） |
| `POST` | `/api/admin/data-report` | `auth`＋管理者 | **いまのデータでスナップショットを作成**。body は `{ slug, title, exam, note }` |
| `DELETE` | `/api/admin/data-report/:id` | `auth`＋管理者 | 削除（誤作成用） |
| `POST` | `/api/admin/reset-exam-scores` | `auth`＋管理者 | **得点列を一括で NULL に戻す**（次の試験の入力を空から始めるため） |

### `POST /api/admin/reset-exam-scores` の注意

- 消すのは **`ouri_score` / `math_score` / `kakougaku_score` / `nekku_score` / `seigyo_score`** の5列。
  前期末で使い回す列なので、前期中間の点が残っていると前期末の点として表示されてしまう
- **`test_score` は絶対に消さない**（前期中間の英語の点＝テスト予測の記録でもある）
- `ai_score` / `eigo_score` は新設で最初から空なので対象外
- body に `{ "confirm": "<直前に作ったレポートの slug>" }` を要求し、
  **そのレポートが存在しなければ 400 で断る。** 保存前に消す事故を防ぐ
- 何件更新したかを返す

- 管理者判定は `server.js` の既存の管理者チェックの書き方に合わせる（`/api/admin/*` の既存実装を読んで同じにする）
- 同じ `slug` で再作成しようとしたら 409 を返す。**上書きしない**（歴代データを壊さないため）

### ページ `reports.html`

- `ouyoubutsuri-notes.html` と同じ作り（`theme.css` ＋ `api/nav/app-shell/util.js` ＋ `appShell.mount`）
- 一覧：新しい順にカード。タイトル・試験名・作成日・メモ・「人数／テスト数／問題数」
- 詳細：`reports.html?r=<slug>` で1件表示
  - 科目別成績の表（レポート作成時点の科目だけを列にする）
  - 合計・平均・順位
  - クラス順位（確定点の一覧。コマの座標は数値の表でよい）
  - 時間割
  - テスト一覧（科目・試験・タイトル・問題数）
- **レポートは読むだけ。編集・削除のUIはページに置かない**（削除は管理画面から）

### ☰メニュー

`js/nav.js` の `APP_NAV` に追加する（`hamburger-nav-must-cover-new-pages` の方針）：

```js
{ key: 'reports', icon: '🗄', label: 'データレポート', href: '/reports.html' },
```

置き場所は「メンバー」の後・「管理」の前。

### 管理画面

`admin.html` に「データレポート」セクションを追加：
- 入力：slug（初期値 `YYYY-<任意>`）・タイトル・試験名・メモ
- ボタン「📄 いまのデータでレポートを作成」→ `POST /api/admin/data-report`
- 作成済みレポートの一覧（作成日つき）と削除ボタン
- **成功したら「作成しました」と slug を表示する。** 押したのに何も起きない状態を作らない
- レポート一覧の下に **「🧹 得点をリセット（次の試験の準備）」** ボタン。
  押すと「どのレポートに保存済みか」を選ばせ、確認ダイアログを出してから
  `POST /api/admin/reset-exam-scores` を呼ぶ。**レポートを選ばずには実行できないようにする**

---

## フェーズ2：科目別成績・クラス順位の前期末仕様化

**フェーズ1を先に完成させ、利用者が前期末のレポートを作ってから着手すること。**

### 方針：科目を設定で持つ

前期中間→前期末で「列を足す」やり方を続けると、試験のたびに DB とページの両方を直すことになる。
**科目定義を1か所にまとめ、そこを変えれば成績ページとクラス順位が追従する形にする。**

`server.js` の先頭付近（`SCORE_COL` の場所）に：

```js
// 試験ごとの科目定義。試験が変わったらここに1本足して CURRENT_EXAM を差し替える。
// データレポートはこの定義を使って「その試験の科目」で焼き付ける。
// 前期中間（6科目）＝ いま scores.html に並んでいる列。英語は test_score であることに注意
const SUBJECTS_CHUKAN = [
  { key: 'eigo',      label: '英語',           column: 'test_score',      color: '#86efac', icon: '📘' },
  { key: 'ouri',      label: '応用物理',       column: 'ouri_score',      color: '#46d6c4', icon: '⚡' },
  { key: 'math',      label: '応用数学',       column: 'math_score',      color: '#f06b8e', icon: '📐' },
  { key: 'kakougaku', label: '加工学',         column: 'kakougaku_score', color: '#f59e0b', icon: '⚙️' },
  { key: 'nekku',     label: '熱流体',         column: 'nekku_score',     color: '#7c6af7', icon: '🔥' },
  { key: 'seigyo',    label: '制御工学',       column: 'seigyo_score',    color: '#a78bfa', icon: '🎛️' },
];

// 前期末（7科目）＝ 試験時間割どおり。英語は eigo_score（test_score は使わない）
const SUBJECTS_MATSU = [
  { key: 'math',      label: '応用数学',       column: 'math_score',      color: '#f06b8e', icon: '📐' },
  { key: 'ai',        label: '人工知能概論',   column: 'ai_score',        color: '#38bdf8', icon: '🤖' },
  { key: 'kakougaku', label: '加工学',         column: 'kakougaku_score', color: '#f59e0b', icon: '⚙️' },
  { key: 'ouri',      label: '応用物理Ⅱ',     column: 'ouri_score',      color: '#46d6c4', icon: '⚡' },
  { key: 'nekku',     label: '熱流体工学Ⅰ',   column: 'nekku_score',     color: '#7c6af7', icon: '🔥' },
  { key: 'seigyo',    label: '制御工学Ⅰ',     column: 'seigyo_score',    color: '#a78bfa', icon: '🎛️' },
  { key: 'eigo',      label: '科学技術英語Ⅰ', column: 'eigo_score',      color: '#86efac', icon: '📘' },
];

const SUBJECT_SETS = { '前期中間試験': SUBJECTS_CHUKAN, '前期末試験': SUBJECTS_MATSU };
const CURRENT_EXAM = '前期末試験';
const EXAM_SUBJECTS = SUBJECT_SETS[CURRENT_EXAM];
```

- 新しい列 `ai_score`・`eigo_score` を `ALTER TABLE users ADD COLUMN IF NOT EXISTS` で追加
- `SCORE_COL` は `EXAM_SUBJECTS` から組み立てる（`Object.fromEntries(EXAM_SUBJECTS.map(s => [s.key, s.column]))`）
- `GET /api/exam-subjects` を新設し、`{ exam: CURRENT_EXAM, subjects: EXAM_SUBJECTS }` を返す
- `GET /api/scores` は `EXAM_SUBJECTS` の列を動的に SELECT する
- **`SUBJECT_SETS` はフェーズ1でも使う。** データレポートは
  `SUBJECT_SETS[body.exam]`（無ければ `EXAM_SUBJECTS`）で科目を決めて焼き付ける。
  これで「前期中間のレポートは6科目、前期末のレポートは7科目」が自然に成立する

### `test_score` の扱い

`test_score` は**前期中間の英語の点**であると同時に、**テスト予測（predict.html）と賞金分配で使っている**。

- **前期中間の科目定義には入れる**（英語の点として。レポートに焼き付けるため）
- **前期末の科目定義には入れない**。前期末の英語は `eigo_score`
- 得点リセットでも**消さない**
- 既存の `/api/test/*`・`award-worst`・`distribute-pool` の挙動を変えない

### 前期中間のデータをどうするか

前期中間の得点は `users` の既存列に入っている。前期末は**同じ列を使い回す**。
したがって手順は必ずこの順：

1. フェーズ1をデプロイ
2. 利用者が「2026 前期中間試験」のレポートを作成（ここで前期中間が永久保存される）
3. 利用者が「得点をリセット」を実行（列が NULL に戻る）
4. **そのあとで**フェーズ2をデプロイ

**2 と 3 が終わったことを利用者に確認してからフェーズ2に進むこと。**
リセットしないまま前期末仕様にすると、点数を入れ直していない人の前期中間の点が
前期末の点として表示され続ける。

### `scores.html`

- 起動時に `/api/exam-subjects` を読み、**列・入力ボタン・色をそこから生成する**
- 現在ベタ書きの5つの入力ボタンと `seigyoActive` の日付分岐を削除
- 平均・合計は「入力済み科目のみ」の現行ロジックを維持
- 「みっつー波多野ライン」の表示は現行のまま壊さない

### クラス順位（server.js）

- 満点の自動算出：`EXAM_SUBJECTS` の列を回して「1人でも入力済みの科目数 × 100」にする
- `USER_CLRANK_MAP` の自動反映：**`EXAM_SUBJECTS` の全科目が埋まっている人**の合計を確定点にする
  （いまは5科目固定で制御が抜けている）
- `clrank.html` 側で満点や科目数をベタ書きしている箇所があれば `/api/class-rank` の値を使う形に直す

---

## フェーズ3：ホームから時間割を外す

- `index.html` の `#timetable-card`・`loadTimetable()`・`toggleTimetable()`・関連CSSを削除
- **`exam_timetable` テーブル・API・管理画面の時間割管理は残す。** 次の試験でまた使うため
- 削除前に、時間割がフェーズ1のレポートに入っていることを確認する

### 【重要】起動時シードも消すこと

`server.js:113` 付近に「`exam_timetable` が空なら前期末の7件を入れる」シードがある
（本番で確認済み：`/api/exam-timetable` に前期末7件が残っている）。
**これを消さないと、管理画面から行を削除してもサーバー再起動で同じ7件が復活する。**

- シードの配列と、それを流し込む `INSERT` ループを削除する
- `CREATE TABLE IF NOT EXISTS exam_timetable` と API は残す
- 次の試験の時間割は**管理画面から手で登録する**運用にする（コードに埋め込まない）

---

## やってはいけないこと

- **アーカイブ機能を作り直さない。** 既に管理画面にある
- `test_score` まわり（テスト予測・賞金分配・ワースト賞）の挙動を変えない
- `users` の既存の得点列を削除・リネームしない
- `materials/` と `前期末　英語/` をコミットしない
- `theme.css` の `:root` を汚染しない
- レポートに個人の連絡先・認証情報を入れない

## 確認

`server.js` は `DATABASE_URL` が無いと起動しないので、**DBを伴う動作確認はローカルではできない。**
できる範囲で必ず確認すること：

- `node --check server.js` ／ 変更した js が構文エラーなし
- 静的配信（`.claude/launch.json` の設定を使う）で `reports.html`・`scores.html`・`index.html` を開き、
  **API が 404 でもページが壊れず「読み込めませんでした」相当の表示になる**こと
- ☰メニューに「データレポート」が出て、`reports.html` に遷移できること
- `index.html` から時間割カードが消えていること（フェーズ3）
- `buildTestsIndex()` が単体で動くこと（`node -e "console.log(require('./tests-index').buildTestsIndex().length)"`）

DB を伴う確認（レポート作成・科目の増加）は、**デプロイ後に利用者が本番で行う**。
そのための手順を報告に書くこと。
