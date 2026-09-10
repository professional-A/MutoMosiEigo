# 模試ページのナビゲーションドロワー 設計書

- 日付: 2026-09-11
- 状態: 設計確定
- 関連: `js/app-shell.js`（ドロワー実装の先行例）、`tests-index.js` / `GET /api/tests`、`js/nav.js`（`APP_NAV`）
- 実装方式: マルチページ／ビルドなし／`express.static('.')` のまま

## 背景

同じ試験（＝同じ実施回）に対して同じ科目の模試が複数ある場合、今は模試ページ（`quiz.html`）から別の模試へ直接移動できない。左下固定の「← トップへ」ピルでホームに戻り、フォルダ → 科目 → 試験と辿り直す必要がある。

`quiz.html` は `data.json` を取得して `js/quiz-engine.js` の `window.initQuiz(data)` に渡すだけのローダーで、描画はすべて `quiz-engine.js` が行う（独自ヘッダー＋スティッキー採点バー＋左下「← トップへ」ピル）。共通の `js/app-shell.js` は mount していない。

## スコープ

**やる:**

- `quiz-engine.js` が描画するスティッキー採点バー（`.scoreboard .wrap`）の右端に `☰` ボタンを追加する。
- `☰` で右から出るドロワーを開き、次の3グループを上から順に表示する:
  1. **同じ試験・同じ科目** の他の模試（`year` / `grade` / `exam` が完全一致し `subject` も一致）
  2. **同じ試験・他の科目** の模試（`year` / `grade` / `exam` 一致で `subject` 不一致）
  3. **メニュー**（`APP_NAV` の分離ページ一覧、`adminOnly` は除外）
- 新規 `js/quiz-nav.js` にドロワーのロジックを閉じ込め、`quiz-engine.js` から読み込んで mount する。
- `styles/theme.css` にドロワーのグループ見出し用クラスを1つ追加。既存の `.appshell-drawer` / `.appshell-backdrop` を流用。

**やらない:**

- フル `app-shell` の mount（共通ヘッダー・ログイン・アバター・お知らせを模試ページに乗せる案は不採用。今回は移動手段の追加に絞る）。
- 既存のヘッダー・採点バーの構造／見た目・問題描画・左下「← トップへ」ピルの変更。
- `quiz.html` 自体の変更。
- `/api/tests` のレスポンス形式変更、サーバー側の変更。
- 認証・`isAdmin` 判定（模試ページは認証情報を持たない）。
- 並び順の指定機能（`/api/tests` が返す順のまま）。

## 「同じ試験」の定義

`year`（数値）・`grade`（数値）・`exam`（文字列）の **3つすべてが一致** するものだけを「同じ試験」とする。年度・学年をまたがない。`index.html` が試験内を `${year}年度 ${grade}年生` で小グループ化しているのと同じ粒度。

## ドロワーの内容

| 見出し | 内容 | 空のときの扱い |
|---|---|---|
| `同じ試験・{data.subject}` | `year`/`grade`/`exam` 一致かつ `subject === data.subject`。`type:"summary"` の教材も含める。 | 兄弟が無くても現在の模試（表示中）は出るので、常に表示。 |
| `同じ試験・他の科目` | `year`/`grade`/`exam` 一致かつ `subject !== data.subject`。表記は `{subject} — {title}`。 | 該当0件なら見出しごと非表示。 |
| `メニュー` | `window.APP_NAV` を順に。`adminOnly:true` は除外。`icon` ＋ `label` ＋ `href`。 | 常に表示。 |

- **現在の模試**: グループ1の中に、他の兄弟と同じ位置（`/api/tests` の順）で表示するが、リンクにせず `<span aria-current="page">{title}（表示中）</span>` として出す。別途の「表示中」見出しは作らない。
- **現在の模試の判定**: `/api/tests` の各エントリの `path`（`/quiz.html?d=tests/<dir>/data.json`）の `d=` の値と、現在ページの `new URLSearchParams(location.search).get('d')` を文字列比較する。
- **並び順**: `/api/tests` が返す配列順（`tests/` の `readdir` 順＝フォルダ名順）をそのまま使う。グループ1・2それぞれ、その順で表示。

## アーキテクチャ

### 新規 `js/quiz-nav.js`

IIFE で `window.quizNav = { mount: function (data) { … } }` を公開する。`mount(data)` の処理:

1. `document.querySelector('.scoreboard .wrap')` に `<button class="appshell-hamburger" aria-label="メニュー" aria-expanded="false">☰</button>` を append。
2. `.appshell-backdrop` と `.appshell-drawer`（`aria-hidden="true"`）を生成し `document.body` に append。
3. 開閉を配線:
   - `☰` クリック → `.open` を drawer / backdrop にトグル、`aria-expanded` / `aria-hidden` を更新。
   - backdrop クリック → 閉じる。
   - `keydown` で `Escape` → 閉じる（開いている間だけ `document` にリスナを張る）。
4. `fetch('/api/tests')` して配列を取得:
   - `data.year != null && data.grade != null && data.exam != null` のときのみ、`t.year === data.year && t.grade === data.grade && t.exam === data.exam` で絞り込み、`subject` の一致/不一致でグループ1/2に振り分けて DOM 構築。
   - fetch 失敗、または `year/grade/exam` のいずれか欠落時は、グループ1/2をスキップ。
5. グループ3を `window.APP_NAV`（`js/nav.js` で定義）から構築。`item.adminOnly` は除外。各項目は `<a href=item.href>` に `<span class="appshell-drawer-ico">item.icon</span>` ＋ `item.label`。リンククリックで drawer を閉じる（画面遷移するので実質不要だが揃える）。
6. 各グループの前に `<div class="appshell-drawer-group">見出し</div>` を置く。中身が0件のグループ（グループ2のみ該当しうる）は見出しごと生成しない。
7. HTML 生成時のユーザー文字列（`title` など）は `js/util.js` の `esc` があれば使う。無ければ `textContent` 代入で組み立てる（`quiz-nav.js` は `util.js` の読み込みに依存しない作りにする）。

### `js/quiz-engine.js` の変更（最小・DOM 再構成なし）

`initQuiz` 内、`renderAll();` の直後に次を追加する:

```js
addScript('/js/nav.js', function () {
  addScript('/js/quiz-nav.js', function () {
    if (window.quizNav) window.quizNav.mount(_data);
  });
});
```

`addScript` は `quiz-engine.js` の既存ヘルパー。`js/nav.js` は `window.APP_NAV` を定義するだけの軽いファイル。`quiz.html` は変更しない。

### `styles/theme.css` への追記

既存の `.appshell-drawer` / `.appshell-drawer a,button` / `.appshell-drawer-ico` / `.appshell-backdrop` はそのまま流用できる（純 CSS で `.open` の付け外しだけで動く）。追加するのは:

```css
.appshell-drawer-group{
  padding:14px 18px 4px;
  font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;
  color:var(--dim);
}
.appshell-drawer span[aria-current="page"]{
  display:flex;align-items:center;gap:12px;width:100%;
  padding:11px 18px;font-size:.92rem;
  color:var(--dim);cursor:default;
}
```

`span[aria-current="page"]` は `.appshell-drawer a,button` のセレクタに当たらないので、リンクと同じ余白・行高を自前で指定する。

## エッジケース

- **`year`/`grade`/`exam` 欠落 or `/api/tests` 失敗**: グループ1・2を省略し、グループ3（メニュー）だけ表示。移動手段は常に確保する。
- **その試験でその科目が自分だけ**: グループ1は「{title}（表示中）」のみ。
- **他科目が0件**: グループ2の見出しごと非表示。
- **z-index**: 採点バー `50` < backdrop `250` < drawer `251`。ドロワーは採点バーの上に出る。`☰` は採点バー（`position:sticky; top:0`）の中なのでスクロールに追従する。
- **モバイル**: `.scoreboard .wrap` は `flex-wrap:wrap`。`☰` が1個増えるだけ。狭い画面で次行に折り返しても許容。
- **左下「← トップへ」ピル**: メニューの 🏠ホーム と役割が重複するが、今回は触らず残す。

## テスト（自動テスト基盤なしのため手動）

1. 同じ試験・同科目に複数の模試がある `data.json` を開く → グループ1に全兄弟＋「（表示中）」、グループ2に他科目、グループ3にメニューが出る。
2. その試験でその科目が1つだけの模試を開く → グループ1は「（表示中）」のみ、グループ2は他科目あれば表示。
3. `exam` を持たない `data.json`（または一時的にフィールドを消す）→ メニューだけ表示、エラーにならない。
4. オフライン（`/api/tests` を失敗させる）→ メニューだけ表示。
5. `☰` で開閉、背景クリックで閉じる、`Esc` で閉じる。
6. 375px 幅で採点バーが崩れない、ドロワーが画面幅の 80vw（最大 280px）で出る。
7. グループ1・2の各リンク先が正しい模試（`/quiz.html?d=…`）に飛ぶ。メニューの各リンクが分離ページに飛ぶ。
