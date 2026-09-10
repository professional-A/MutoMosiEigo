# フェーズ3 バッチ7 — index.html から抽出済みモーダル markup / 関数 / 重複CSS を削除 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** バッチ2〜6で独立ページに抽出済みの13モーダル（`#test-modal-bg` / `#scores-modal-bg` / `#members-modal-bg` / `#clrank-page` / `#battle-modal-bg` / `#race-view-bg` / `#admin-modal-bg` / `#login-modal-bg` / `#schedule-modal-bg` / `#timetable-modal-bg` / `#race-modal-bg` / `#pair-modal-bg`）の markup と、それだけが呼ぶ関数群（約110個）、`styles/theme.css` に一本化済みの重複CSSを `index.html` から削除する。約3956行 → 目標 2000行前後。**機能追加・変更はゼロ（純クリーンアップ）。**

**Architecture:** `index.html` はホーム（試験フォルダ一覧・ランキング・時間割カード・お知らせパネル）と共通シェル呼び出し・認証ブートストラップ・テーマ切替・自前アバターモーダルだけを残す。ナビは既に `window.APP_NAV`（バッチ6）。

**リスク:** **本番稼働中の `index.html` から約1500〜2000行を削除する。** 削除対象関数がホーム側から呼ばれていないことをタスクごとに grep ゲートで確認し、削除後にホームをブラウザ検証する。1タスク1モーダル群・1コミット。問題が出たらそのタスクで停止できる構成。

**方針メモ:**
- **`#avatar-modal-bg` と関連6関数（`openAvatarModal`/`renderFrameGrid`/`selectFrame`/`closeAvatarModal`/`selectAvatar`/`saveAvatar`）は残す。** `index.html` は `onAvatar: openAvatarModal`（自前）を維持。app-shell 内蔵ピッカーは独立ページ用。
- **`#survey-modal-bg` と `initSurveyBanner`/`openSurveyModal`/`submitSurvey` は残す**（アンケート終了済みだが `openSurveyModal` は「回答済みです」alert を返すだけ・害なし。削除は Task 9 で任意）。
- **`loadRaceSection` は手術して残す**（`updateAuthBar` が呼ぶ・`#race-view-btn`＝ナビの race リンク表示制御に使う）。`_renderRace`/`_fmtMin`/`_fmtSec`/`toggleRaceTool` 等は削除。
- **`onIdLogin: openLoginModal` → 削除**（app-shell の既定 `defaultIdLogin`＝`location.href='/login.html'` に任せる。`mount` の `onIdLogin:` 行ごと削除）。
- **ホームが必要とするので残す関数（抜粋）:** `loadExamSchedule`/`applyExamArchive`、`tt*` ヘルパ全部・`loadTimetable`/`renderTimetable`/`toggleTimetable`、`applyTheme`/`loadTheme`、`toggleShowArchived`/`getProgress`/`renderFolders`/`openSubject`/`closeSubject`/`renderExamFilter`/`filtered`/`renderGroups`/`retryTest`/`setExam`、`applyFrame`、`updateAuthBar`/`syncLayout`、`loginWithGoogle`/`doLogout`/`syncPasswordUser`/`syncUser`、`lockScroll`/`unlockScroll`、`loadRanking`、`loadBanners`/`submitBanner`/`deleteBanner`/`loadTicker`/`toggleNotif`、`showPointToast`（util.js）。
- CSS 削除（Task 1）は「`styles/theme.css` に同一ルールがある」ものだけ。ホーム専用CSS（`.folder-*`/`.subject-*`/`.notif-*`/`.ticker-*`/`.race-hd`（ホーム掲示）/`#header-stack`/`.theme-dot` 等）は残す。

---

## 各タスク共通の手順テンプレート

1. **削除対象の markup 行範囲と関数名リストを確定**（`grep -n`）。
2. **caller ゲート:** 削除する各関数名について
   ```bash
   grep -nE '\b<fn>\s*\(' index.html | grep -v '^\s*[0-9]+:(async )?function '
   ```
   を実行し、**ヒットが「削除対象の markup / 他の削除対象関数の中」だけ**であることを確認。ホーム側（onload・`updateAuthBar`・ホームの `onclick=`）からのヒットがあれば STOP して報告。
3. markup ブロックと関数群を削除。
4. `node --check`（インライン script 抽出）。
5. **静的サーバ + claude-in-chrome でホーム（`index.html`）を開く:** コンソールに新規エラーが無い／試験フォルダ一覧・ランキング・時間割カード・お知らせパネルが従来通り描画／ハンバーガー（`APP_NAV`）が動く／アバターモーダルが開く。
6. `git commit`（1タスク1コミット、`refactor(3-7): <モーダル群> を index.html から削除`）。

---

## Task 1: 重複CSS を `index.html <style>` から削除

**Files:** Modify `index.html`（`<style>` 内、12-426 行）。

- [ ] **Step 1:** `styles/theme.css` に存在するルールを機械照合。次で「theme.css にあり index.html にもある」セレクタを列挙:
```bash
node -e "
const fs=require('fs');
const idx=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles/theme.css','utf8');
const idxStyle = idx.slice(idx.indexOf('<style>')+7, idx.indexOf('</style>'));
const sels = [...idxStyle.matchAll(/^\s*([.#\[][^{,\n]+)\s*[,{]/gm)].map(m=>m[1].trim());
const dup = [...new Set(sels)].filter(s => css.includes(s));
console.log(dup.join('\n'));
"
```
- [ ] **Step 2:** 上記のうち **theme.css と完全同一のルール本文**（値まで一致）だけを `index.html <style>` から削除する。`[hidden]{display:none!important}` / `.modal-bg`〜`.modal-msg` / `.ranking-table`系 / `.rank-*` / `.avatar`(+`:hover`) / `.avatar-lg`/`.avatar-grid`/`.avatar-opt*` / `.frame-<色>`+keyframes / `.frame-section*`/`.frame-grid`/`.frame-opt*` / `.shogou*`/`.title-*`/`.ti-*`+keyframes / `#clrank-page`/`.clrank-*` / `.battle-*` / `.race-*`（`#race-section` は theme.css にあるので可・ただしホーム掲示で使うなら現状維持でも良い→**同一なら削除**）/`.admin-card*` / `.tt-row*`。
  - **残す:** `#header-stack` / `.theme-dot` / `.folder-*` / `.subject-*` / `.notif-*` / `.ticker-*` / `.retry-btn` / `.card-wrap` / `.empty` / ホーム固有の全て。
  - 迷ったら「theme.css の該当行と1文字でも違う」なら**残す**（安全側）。
- [ ] **Step 3:** ブレース収支チェック（`node -e` で `{`/`}` カウント一致）。
- [ ] **Step 4:** 共通手順テンプレの 4〜6（構文チェック・**ホームのブラウザ検証：見た目が変わっていないこと**・コミット）。
```
refactor(3-7): index.html の重複CSSを削除（theme.css に一本化済み分）
```

---

## Task 2: 点数予測モーダル（`#test-modal-bg`）を削除

- **markup:** `#test-modal-bg`（≈598-690）
- **関数（10）:** `openTestModal` `closeTestModal` `loadTestState` `showTestPhase` `loadTestResults` `loadTestPayouts` `submitPrediction` `submitPredictionChange` `submitScore` `submitScoreEdit`
- **caller ゲート注意:** `submitScore`/`submitScoreEdit` は `#test-modal-bg` の `onclick` 由来のみ（`#score-input`/`#score-input-edit`）。ホームに同名要素は無い。`showTestPhase` は `authPoints` を読むが削除で問題なし。
- 共通手順テンプレ。コミット: `refactor(3-7): 点数予測モーダルを index.html から削除`

---

## Task 3: 成績・メンバーモーダル（`#scores-modal-bg` / `#members-modal-bg`）を削除

- **markup:** `#members-modal-bg`（≈901-912）・`#scores-modal-bg`（≈913-937）
- **関数（8）:** `openMembersModal` `closeMembersModal` `openScoresModal` `closeScoresModal` `loadScores` `sortScores` ／ さらにスコア入力の `_submitScore` `_confirmScoreInline` `submitOuriScore` `submitMathScore` `submitKakougakuScore` `submitNekkuScore` `submitSeigyoScore`（`#scores-modal-bg` 内の入力ボタン専用。ホームに `#score-inline-*` 要素は無い）
- コミット: `refactor(3-7): 成績・メンバーモーダルを index.html から削除`

---

## Task 4: クラス順位ページ（`#clrank-page`）を削除

- **markup:** `#clrank-page`（≈938-978）
- **関数（22）:** `openClrankPage` `closeClrankPage` `loadClrankPage` `_clrankRenderAll` `_scoreToTop` `_clrankRenderYAxis` `_clrankRenderBoard` `_clrankRenderPool` `_clrankRenderHint` `_clrankRenderConfirmed` `openClrankConfirmPanel` `closeClrankConfirmPanel` `_clrankRenderAdminMs` `clrankBoardTap` `_clrankBlockTap` `clrankPoolChipTap` `_saveClrankPositions` `_clrankSetConfirmed` `_clrankUnsetConfirmed` `clrankAddConfirm` `clrankRemoveConfirm` `clrankEditConfirm`
- **状態変数:** `CLASS_NAMES` / `_clrankPositions` / `_clrankMaxScore` / `_clrankMinScore` / `_clrankConfirmed` / `_clrankSel` / `_clrankSelBoard` も削除（clrank 専用）。
- コミット: `refactor(3-7): クラス順位ページを index.html から削除`

---

## Task 5: バトルモーダル（`#battle-modal-bg`）を削除

- **markup:** `#battle-modal-bg`（≈889-900）
- **関数（6）＋定数:** `openBattleModal` `closeBattleModal` `loadBattleContent` `selectBattleSide` `updateSideBtns` `submitBattleBet` ／ `BATTLE_SUBJ_LABEL` / `_battleSides`
- コミット: `refactor(3-7): バトルモーダルを index.html から削除`

---

## Task 6: レース閲覧モーダル（`#race-view-bg`）を削除 ＋ `loadRaceSection` 手術

- **markup:** `#race-view-bg`（≈762-809）
- **関数（削除）:** `openRaceView` `closeRaceView` `_fmtMin` `_fmtSec` `_renderRace` `toggleRaceTool` `editPairName` `savePairName` `toggleRaceBody` `submitRaceAll`
- **`loadRaceSection` を次に置換（`updateAuthBar` から呼ばれ続ける）:**
```js
async function loadRaceSection() {
  try {
    const data = await fetch('/api/races/current').then(r => r.json());
    const btn = document.getElementById('race-view-btn');   // APP_NAV の race リンク（id 付き）
    if (btn) btn.style.display = data.race ? '' : 'none';
    _currentRace = data.race || null;
  } catch(e) {}
}
```
（元コードの `if (document.getElementById('race-view-bg')...) _renderRace(data)` 行を除去しただけ。`let _currentRace = null;` の宣言は残す。）
- **caller ゲート:** `_renderRace` / `_fmtMin` 等が `#race-view-bg` markup と各削除関数の外から呼ばれていないこと。`loadRaceSection` の残る caller は `updateAuthBar` のみ（他は Task 7 で消える admin/pair 系）。
- コミット: `refactor(3-7): レース閲覧モーダルを削除・loadRaceSection をナビ制御のみに`

---

## Task 7: 管理モーダル群（`#admin-modal-bg` / `#schedule-modal-bg` / `#timetable-modal-bg` / `#race-modal-bg` / `#pair-modal-bg`）を削除

- **markup:** 5ブロック（≈727-760 / 847-860 / 861-873 / 810-846 / 874-888）
- **関数（約38）:** `openAdminModal` `reloadAdminContent` `grantPoints` `setPoints` `closeAdminModal` `distributePool` `awardWorstFrame` `viewSurveyResults` `adminAddBanner` `adminCreateBattles` `adminCloseRace` `adminAddBattlePair` `adminRefundAllBattles` `adminSettleManual` `adminCloseBattles` `adminSettleBattles` `resetSeasonPoints` `restoreSeasonPoints` `debugPoints` `restorePointsManual` `adjustStudyLog` `grantAll` `awardBakaFrame` `updateLockBtn` `toggleSiteLock` `updateScoreLockBtn` `toggleRegistrationLock` `toggleScoreLock` `openTimetableModal` `closeTimetableModal` `saveTimetableRow` `deleteTimetableRow` `openScheduleModal` `closeScheduleModal` `archiveAllTests` `saveSchedule` `clearSchedule` `openPairModal` `closePairModal` `pairAddGroup` `savePairs` `openRaceModal` `closeRaceModal` `raceAddGroup` `_renderRaceModalUsers` `adminCreateRace`
- **重要な残す判断:**
  - `loadTimetable` / `renderTimetable` / `toggleTimetable` は**ホームの時間割カード**用なので**残す**（`openTimetableModal` だけ削除）。
  - `loadExamSchedule` / `applyExamArchive` は**ホームのアーカイブ判定**用なので**残す**（`openScheduleModal`/`saveSchedule` だけ削除）。
  - `_pairRaceId` / `_pairModalUsers` / `_pairGroupCount` / `_raceModalUsers` / `_raceGroupCount` は削除。
- **caller ゲート特に慎重に**（38関数）。1関数ずつ grep。`renderFolders` から `loadExamSchedule`/`applyExamArchive` が呼ばれる線を確認（残すこと）。
- コミット: `refactor(3-7): 管理モーダル群（admin/日程/時間割/レース発行/ペア設定）を index.html から削除`

---

## Task 8: ログインモーダル（`#login-modal-bg`）を削除 ＋ `onIdLogin` 撤去

- **markup:** `#login-modal-bg`（≈691-725）
- **関数（6）:** `openLoginModal` `closeLoginModal` `showLoginTab` `applyPasswordLogin` `doPasswordLogin` `doRegister`
- **`appShell.mount(...)` の `onIdLogin: openLoginModal,` 行を削除**（app-shell 既定 `/login.html` に委譲）。
- **caller ゲート:** `applyPasswordLogin` は `doPasswordLogin`/`doRegister` からのみ。`syncPasswordUser`（残す）は `localStorage.muto_session` を読むだけで `applyPasswordLogin` に依存しない。
- コミット: `refactor(3-7): ログインモーダルを削除・onIdLogin は login.html へ委譲`

---

## Task 9（任意）: アンケートモーダル（`#survey-modal-bg`）の扱い

- 現状: アンケート終了済み。`openSurveyModal` は `/api/survey/me` を見て「回答済みです😼」alert か markup 表示。ホームの導線（`initSurveyBanner`）は無効。
- **選択肢A（推奨・何もしない）:** 残す。害は無い。
- **選択肢B:** `#survey-modal-bg` markup と `initSurveyBanner`/`openSurveyModal`/`submitSurvey` を削除。`initSurveyBanner()` の呼び出し3か所（うち1つは Task 8 で消える `applyPasswordLogin` 内）も除去。
- ユーザーに確認して決める。

---

## Task 10: 全体ブラウザ検証 ＋ メモリ更新

- [ ] `index.html` の行数を確認（`wc -l` — 目標 ~2000）。
- [ ] `npm start`（要 `DATABASE_URL`）または静的サーバでホームを開き、**段階1チェック**:
  - [ ] 試験フォルダ一覧（`renderFolders`）・科目クリック（`openSubject`）・試験フィルタ（`setExam`）・アーカイブトグル
  - [ ] 時間割カード（`renderTimetable`）・折りたたみ
  - [ ] ランキング表（`loadRanking`）
  - [ ] お知らせパネル（`toggleNotif`・`loadBanners`）・ティッカー
  - [ ] ハンバーガー → 各独立ページへ遷移
  - [ ] アバターモーダル（`openAvatarModal`）が開く・テーマ切替（`applyTheme`）
  - [ ] コンソールに `X is not defined` 系エラーが無い
- [ ] `grep -c "function open" index.html` などで想定通り関数が減ったこと。
- [ ] メモリ `architecture-refactor-2026-09.md` に「バッチ7完了」＋最終行数を記録。フェーズ3 完了を宣言。残＝フェーズ4（サーバー整理・任意）。

---

## Self-Review

**1. Spec coverage:** design doc「`index.html` は全科目の目次だけに」→ Task 1-8 で達成（アバター/テーマ/お知らせ/ホーム一覧のみ残る）。survey は Task 9 で明示的に判断。

**2. Placeholder scan:** 各 Task は「markup 行範囲 + 関数名リスト + caller ゲート grep + ホーム目視」で、削除対象を具体名で列挙。`loadRaceSection` の置換だけ全文明記。削除タスクなので新規コードはほぼ無い。

**3. Type consistency / 残す関数の依存:**
- `updateAuthBar` → `loadRaceSection`（Task 6 で手術・維持）/ `loadRanking` / `loadBanners`（維持）/ `appShell.update`。✓
- `renderFolders` → `getProgress` / `loadExamSchedule` / `applyExamArchive`（全て維持）。✓
- `openAvatarModal`（維持）→ `applyFrame` / `AVATARS` / `AVATAR_NAMES` / `FRAMES` / `selectedAvatar` / `selectedFrame` / `esc` / `renderFrameGrid` / `saveAvatar`（`saveAvatar` → `updateAuthBar` / `loadRanking`）。全て維持対象。✓
- `applyTheme` / `loadTheme` → `THEME_LABELS`（維持）。✓
- `syncUser` / `syncPasswordUser` → `authUnlockedAvatars` / `AVATARS` 等（維持）。✓
- Task 6 の `_currentRace`：宣言は残す・`loadRaceSection` が代入・読み手はバッチ7後は無し（`adminCloseRace` は Task 7 で削除）→ 無害な残置。
