# 科学技術英語Ⅰ 前期末試験 対策一式 ─ 実装仕様

**試験：2026/9/17(木) 9:00–10:30／作成 9/16 深夜（Opus）／実装 Sonnet（3セッション並列）**
**同日、Unit 4 語彙テストの再受験者が数名いる。**

## 0. 資料の場所（リポジトリ直下・gitignore 済み）

`前期末　英語/`（全角スペース）。**このフォルダの中身を公開領域にコピーしない・参照しない・コミットしない。**
`express.static('.')` がリポジトリ全体を公開するため。

| ファイル | 中身 | 読み方 |
|---|---|---|
| `前期末試験連絡 (2026).pdf` | **試験範囲と出題形式**（1章に要約） | テキスト抽出可 |
| `Unit 3 Word List (2026).pdf` | 30語：日本語・英語・品詞・英英定義 | テキスト抽出可 |
| `Unit 4 Vocabulary List (2026).pdf` | 30語：同上 | **日本語が文字化けする。画像化して読む** |
| `科技英語Unit 3 Passage (2026)配布用.pdf` | 教員の解説スライド（言い換え・文法・発問） | 英語は抽出可、**日本語は画像で読む** |
| `科技英語Unit 4 Passage (2026)S.pdf` | 同上＋**Definition の作り方**（item/category/features） | 同上 |
| `Unit 3 Exercises（配布用）PDF.pdf` | Key Phrases・Writing Strategy の**解答と解説** | 同上 |
| `Unit 4 Exercises.pdf` | 同上 | 同上 |
| `20260909_160814〜160905.jpg` | ハンドアウト Unit 3 #1〜#3、Unit 4 #1〜#2（**本人の手書き解答入り**） | 画像 |
| `20260909_161013.jpg` | Brain Storming Sheet #2 | 画像 |
| `20260909_161034.jpg` | How to Express Your Opinions #1（fact/opinion） | 画像 |
| `20260916_231423〜231842.jpg` | **教科書** Unit 3 p.20–24、Unit 4 p.27–31（Word Choice・本文・Exercises） | 画像 |
| `20260916_232228.jpg` | Debate #1（流れ・注意点） | 画像 |

PDF の画像化：
```
"/c/Users/kabu6/AppData/Local/Microsoft/WinGet/Packages/oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe/poppler-25.07.0/Library/bin/pdftoppm" -r 110 -png "<pdf>" "<scratchpad>/<prefix>"
```
写真は EXIF 回転がかかっている。読みにくければ sharp で `.rotate()` してから読む。

**手書き解答は本人のもの。正解とは限らない。** 必ず本文と教員の解説PDFで検証してから採用すること
（制御工学で、過去問の丸を正解と誤認した事故がある）。

**資料で確認できていない箇所：** 教科書 p.24 右欄の文法コラム（「ハイフンでつなぐ」「接続詞＋過去分詞」）は写真の端で一部しか見えない。Unit 4 側の同種コラムは写真に無い。見えている範囲だけを使い、推測で補わないこと。

---

## 1. 試験範囲と出題形式（`前期末試験連絡` より・確定事実）

**範囲**
- Unit 3 & Unit 4 の本文
- Word Choice
- 章末問題のうち **Exercises（Key Phrases, In-Depth Review）、Writing Strategy**
- **除外：Summary、Approaching the Contents、Over to you!** ← 出題しないこと
- ハンドアウト（**Word List、Debate を含む**）

**出題内容（主なもの）**
1. Question & Answer
2. T/F Questions
3. **与えられた definition が表す語を本文中から答える**（数問）
4. Word Choice や章末問題に関わる語彙問題（**教科書の問題の答え以外の重要語句も出題する**）
5. **Debate**（特に：一般的なディベートの流れ、ディベートにおける注意点、**fact と opinion の違い**）

---

## 2. 学習科学上の根拠（必ず守る設計）

| 根拠 | 設計への反映 |
|---|---|
| `match-the-language-of-the-real-exam`：学習時と試験時の言語が違うと効果が目減り | 本番が英語なので、**定義・Q&A・T/F は英語で出す**。日本語は解説と Word Choice の和文だけ |
| **産出（スペル）は産出の練習でしか伸びない**。選択式の練習は選択式のテストには効くが、書かせるテストへの転移は弱い（[Barenberg et al. 2021](https://onlinelibrary.wiley.com/doi/full/10.1002/acp.3796)、[receptive vs productive retrieval](https://www.researchgate.net/publication/303939278_The_Effects_of_Receptive_and_Productive_Word_Retrieval_Practice_on_Second_Language_Vocabulary_Learning)） | 語彙テスト Q2 は英単語を**書かせる**形式。**選択式だけで済ませない。`input` で綴らせる** |
| `competitive-lures-make-mcq-generative` | 誤選択肢は「ありがちな取り違え」で作る（下記） |
| `vary-surface-keep-deep-structure` | 教員が「教科書の問題の答え以外も出す」と明言。**教科書と同じ文だけでなく、同じ語句を別の文脈で使う問題を必ず混ぜる** |
| `feedback-required-when-accuracy-below-50` | 本人の Unit 3 語彙テストは **9/20（45%）**。**全問に解説を付ける** |
| `interleaving-beats-blocked-after-a-day` | 各ステップの最後に **Unit 3/4 混合セクション**を置く |

### 本人の Unit 3 語彙テストの誤答（誤選択肢の設計に使う）

- `current`（電流）→ **`currently` と書いた**：派生語・品詞違いの取り違え
- `embed` → **`ombed`**：綴りミス
- `innovation` の欄に **`neutralize`**：同じリストの別語との混同
- `generate`：空欄（想起できず）
- Q1 でも `absorb / fabric / neutralize` を落としている

→ 誤選択肢には **派生語（current/currently/currency）、同リスト内の近い語、綴りの近い語** を使う。

---

## 3. 【重要】`js/quiz-engine.js` の `input` 判定のバグと対処

```js
function matchInput(val, ans) {
  const n = norm(val);
  const list = Array.isArray(ans) ? ans : [ans];
  return list.some(a => { const na = norm(a); return na === n || n.includes(na) || na.includes(n); });
}
```

部分一致を双方向で許しているため、**`current` が正解の問題で `currently` と入力すると正解になる。**
本人が実際に語彙テストで犯したミスがそのまま素通りする。スペル練習として致命的。

**対処：問題単位のオプトイン `exact: true` を追加する。**
- `q.exact === true` のときだけ、`norm(val) === norm(a)` の完全一致で判定する
- `exact` のとき、**空文字は常に不正解**
- `exact` が無い問題の挙動は**一切変えない**（既存5テストが `input` を使っている）
- `matchInput` の呼び出し元を読み、最小限の変更で `q` の情報を渡す
- **この変更はセッションAだけが行う。** B・C は `quiz-engine.js` に触らない

---

## 4. 作るもの一覧

共通メタ：`year: 2026, grade: 4, exam: "前期末試験", subject: "科学技術英語Ⅰ"`（中間の英語テストと同じ subject 文字列）

| # | 置き場所 | title | 目安 | 担当 |
|---|---|---|---|---|
| 0 | `tests/2026-4-zenki-matsu-eigo-vocabtest4/data.json` | `科学技術英語Ⅰ ・ Unit 4 語彙テスト（本番形式）` | 90 | **A（最優先）** |
| 1 | `tests/2026-4-zenki-matsu-eigo-step1-tango/data.json` | `科学技術英語Ⅰ ・ Step1 単語` | 340 | A |
| 2 | `tests/2026-4-zenki-matsu-eigo-step2-jukugo/data.json` | `科学技術英語Ⅰ ・ Step2 熟語・Key Phrases` | 130 | C |
| 3 | `tests/2026-4-zenki-matsu-eigo-step3-bunpo/data.json` | `科学技術英語Ⅰ ・ Step3 文法・構文` | 130 | C |
| 4 | `tests/2026-4-zenki-matsu-eigo-step4-honbun/data.json` | `科学技術英語Ⅰ ・ Step4 本文理解・ハンドアウト・Debate` | 300 | B |
| 5 | `eigo-honbun.html`（直下）＋ `tests/_legacy.json` | `科学技術英語Ⅰ ・ 本文内容解説` | — | C |

テストは data.json のみ（`.claude/skills/test-creation-workflow.md`）。

---

## 5. 0 — Unit 4 語彙テスト（本番形式）【最優先】

Unit 3 語彙テストの実物（20点満点）と**同じ形式**にする。

**実物の形式**
- **Q1（1点×10）**：英英定義 A〜J に合う語を、番号付きの10語の Word List から選ぶ
- **Q2（2点×5）**：日本語＋英英定義が与えられ、**英単語を書く**。定義にカッコ内補足がある場合あり（例：`to produce something (such as electricity)`）

**作り方**
- 出典：`Unit 4 Vocabulary List (2026).pdf` の30語**だけ**
- **Q1形式（30問）**：30語を10語ずつ3ブロックに分け、各ブロックで「定義→語」を10問。選択肢は**そのブロックの10語すべて**。`single`
- **Q2形式（30問）**：30語すべてを「日本語＋定義 → 英語を綴る」。**`type:"input"` かつ `exact:true`**
- **弱点セクション（30問）**：`input`＋`exact`
  - 句動詞：`soak up`, `flush out`, `cut back`（空白の入り方）
  - 綴り注意：`sanitation`, `intensify`, `precious`, `discard`, `glacier`, `wetland`, `meager`, `sewage`, `purify`, `threaten`, `trigger`
  - **Word List の誤植**：リストでは `groudwater`。**正解は `groundwater`**。解説に一言
  - `lie`（存在する）は `lay`（lie の過去形／横たえる）との混同を解説で
  - 派生語を誤答として想定した問い（`extract`/`extraction`、`purify`/`pure`、`threaten`/`threat`、`intensify`/`intense` など）
- `ans` に別解を入れてよいのは本当に同じ語の綴りだけ（`meager`/`meagre`）

### Unit 4 Vocabulary List（画像で確認済み）

| # | 日本語 | English | 品詞 | Definition |
|---|---|---|---|---|
| 1 | 液体 | liquid | n | A substance that is not solid or gas and can flow, like water or milk. |
| 2 | 〜の下に | beneath | prep | In a lower place; under something. |
| 3 | 地下水 | groundwater（リストは groudwater と誤植） | n | Water that is found under the ground. |
| 4 | 氷河 | glacier | n | A large, slow-moving mass of ice on mountains or near the poles. |
| 5 | 貧弱な・乏しい | meager | a | Very small or not enough. |
| 6 | 存在する | lie | v | To be located in a particular place |
| 7 | 〜に潜む | lurk | v | To be in a hidden place, often for something bad. |
| 8 | 平原、平野 | plain | n | A large area of flat land with few trees. |
| 9 | 隙間 | gap | n | An empty space or hole in the middle of something. |
| 10 | 吸い上げる | soak up | p.v. | To absorb a liquid. |
| 11 | 漏れる | leak | v | To let liquid or gas escapes through a hole or crack. |
| 12 | 泉 | spring | n | A place where water comes up from the ground naturally. |
| 13 | 送り込む・餌を与える | feed | v | To supply with something; to give food to a person or animal. |
| 14 | 湿地 | wetland | n | An area of land that is often wet, like a marsh or swamp. |
| 15 | 取り出す・抽出する | extract | v | To take out something, especially using force or effort. |
| 16 | (公衆)衛生 | sanitation | n | the process of keeping places free from dirt, infection, disease, etc., by removing waste, trash and garbage, by cleaning streets, etc. |
| 17 | 喉の乾き | thirst | n | The feeling of needing to drink something. |
| 18 | 気候 | climate | n | The usual weather conditions in a place. |
| 19 | 〜を強める | intensify | v | To make something stronger or more extreme. |
| 20 | 一気に流入する | rush | v | To move or go somewhere quickly. |
| 21 | 縮小する・縮む | shrink | v | To become smaller in size. |
| 22 | 〜を脅かす | threaten | v | To be likely to cause harm or damage. |
| 23 | 〜を引き起こす | trigger | v | To cause something to start happening. |
| 24 | 〜を注入する | inject | v | To put liquid into something, usually with a needle. |
| 25 | 〜を噴出させる | flush out | p.v. | To cause something to leave a hiding place |
| 26 | 〜を捨てる・廃棄する | discard | v | To throw something away. |
| 27 | 下水 | sewage | n | Waste water and waste materials that are carried away from homes and buildings. |
| 28 | 〜を減らす | cut back | p.v. | To reduce the amount of something. |
| 29 | 浄化する | purify | v | To make something clean and free of harmful substances. |
| 30 | 貴重な | precious | a | Very valuable or important. |

定義文はリストの原文どおり使う（`leak` の "escapes" の文法ミスも原文ママでよい）。

---

## 6. Step1 — 単語（340問）

出典：Unit 3 Word List 30語、Unit 4 Vocabulary List 30語、**Word Choice 20問**、**教科書の語注（Notes）の語**。

| セクション | 内容 | 形式 | 数 |
|---|---|---|---|
| U3 英→日 | 英単語→日本語 | single | 30 |
| U3 日→英 | 日本語→英単語 | single | 30 |
| U3 定義→語 | 英英定義→語 | single | 30 |
| U3 綴り | 日本語＋定義→綴る | input＋exact | 30 |
| U4 英→日／日→英／定義→語／綴り | 同上 | 同上 | 120 |
| Word Choice 教科書そのまま | 20問（下の解答キー） | single | 20 |
| Word Choice 別文脈 | 同じ正解語を**別の英文**で | single | 20 |
| 本文の重要語（リスト外） | 語注の語（下記） | single | 40 |
| 混合（U3/U4） | 全範囲シャッフル | single | 20 |

### Word Choice 解答キー（教科書に解答が無いため Opus が解いた。本文と照合済み）

**Unit 3 Part 1**（a. absorb b. apparel c. compounds d. grip e. pores f. uneven）
1 通信販売の衣料ビジネスを始める launch a mail-order (**apparel**) business ／ 2 ハンドルをしっかり握る (**grip**) the wheel tightly ／ 3 でこぼこの地面を走る run on (**uneven**) ground ／ 4 いくつかの有機化合物を合成する synthesize some organic (**compounds**) ／ 5 食物から栄養を吸収する (**absorb**) nutrients from food ／ 余り：pores

**Unit 3 Part 2**（a. fabric b. friction c. generate d. lab e. sole f. retail）
1 速乾性の布地を開発する develop a quick-drying (**fabric**) ／ 2 高い利益を生むために休みなく働く work round the clock to (**generate**) a high profit ／ 3 二国間の貿易摩擦を最小限にする minimize the trade (**friction**) between the two countries ／ 4 大手小売チェーン店に投資する invest in a large (**retail**) chain ／ 5 最先端の研究所として評判を得る gain a reputation for a cutting-edge (**lab**) ／ 余り：sole

**Unit 4 Part 1**（a. beneath b. crops c. extract d. lurk e. sanitation f. wetlands）
1 写真の下の短い説明文を読む read the caption (**beneath**) the photos ／ 2 茂みの背後に潜む (**lurk**) behind the bushes ／ 3 空気から水分を取り出す (**extract**) moisture from the air ／ 4 適切な衛生設備を利用できる have access to proper (**sanitation**) ／ 5 病気に強い作物を育てる grow disease-resistant (**crops**) ／ 余り：wetlands

**Unit 4 Part 2**（a. inject b. intensify c. purify d. sewage e. thirst f. threaten）
1 激しい喉の渇きに苦しむ suffer from a burning (**thirst**) ／ 2 戦争終結に向けた外交努力を強化する (**intensify**) diplomatic efforts to stop the war ／ 3 人類の生存を脅かす (**threaten**) the survival of human beings ／ 4 壊れた下水管を修理する repair the broken (**sewage**) pipes ／ 5 水の浄化に塩素を使う use chlorine to (**purify**) water ／ 余り：inject

### 本文の重要語（リスト外・教科書 Notes より）

**U3**：veg out（のんびり過ごす）, be dreaming up（〜を考え出している）, comfier（comfy「心地よい」の比較級）, pop-out spikes on the sole（靴底から飛び出すスパイク）, keep one's footing（踏ん張る）, terrain（地形）, metal-organic framework（金属有機構造体）, war-torn（戦争で荒廃した）, attire（衣装、服装）, layer up（何層も重ねる）, humming through（〜を通じてぶんぶん音を立てる）, on the flip side（その一方で）, pore（孔）, infrared wave（赤外線波）, garment（衣類、衣服）, power outlet（電源コンセント）, sewn into（〜に縫い込まれた）, soak up the sun（太陽光線を吸収する）, on the go（外出先で）, triboelectric（摩擦電気の）, when bent or flexed（たわめたり曲げたりするとき）, piezoelectric（圧電性の）, be fashioned into（〜に形作られる）, conductive（導電性の）, magnetized（磁化された）, far from hitting（〜に到達するにはほど遠い）, retail racks（小売店等の棚）, apparel, wardrobe
**U4**：stash（隠されているもの）, ice cap（氷冠）, soak up（〜を吸い上げる）, aquifer（帯水層）, seep down into（〜にしみこむ）, wetland（湿地）, quench（渇きをいやす）, storm drain（雨水管）, arid（乾燥した）, dwindle（減少する）, sucking the ground dry（地面から水分を吸い上げつくす）, trigger（〜を引き起こす）, meanwhile（一方で）, pollute（〜を汚染する）, arsenic（ヒ素）, mining（採掘）, be injected（注入された）, fracking（水圧破砕法）, discarded device（破棄された機器類）, have also tainted（〜も汚した）

---

## 7. Step2 — 熟語・Key Phrases（130問）

| セクション | 内容 | 形式 | 数 |
|---|---|---|---|
| Key Phrases 教科書そのまま | U3・U4 各5問。**語形変化まで含めて選ばせる** | single | 10 |
| Key Phrases 語形 | 同じ文で正しい語形を選ぶ（`working out`/`work out`/`worked out`/`to work out`） | single | 10 |
| Key Phrases 別文脈 | 同じ10句を**新しい英文**で。各句3問 | single | 30 |
| 句動詞・熟語の意味 | 下記リスト → 意味 | single | 40 |
| 本文の言い換え | 教員スライド・ハンドアウトの `=` の言い換え | single | 30 |
| 混合 | | single | 10 |

### Key Phrases 解答キー（教員解答）

**Unit 3**（語群：break down / embed with / pass through / sew into / work out）
1 I tried to refresh myself by (**working out**) at the gym after doing the housework. — 前置詞 by の後ろは名詞・動名詞
2 Some types of herbal tea will help the body (**break down**) fat. — help + O + 原形
3 Using a credit card (**embedded with**) an IC chip requires special caution. — which is の省略、過去分詞の後置修飾
4 After several minutes of anxiety, our airplane (**passed through**) an air pocket. — 過去形。発音は同じだが形容詞 past ではない
5 A tiny packet of drugs was skillfully (**sewn into**) the lining of her coat. — be動詞と意味から受動態。sew‐sewed‐sewn

**Unit 4**（語群：cut back on / dry out / feed into / leak out / soak up）
1 The sponge will (**soak up**) the spilled water almost immediately.
2 News of the company's financial troubles began to (**leak out**).
3 All the data in each security camera should (**be fed into**) the hard drive in the guards' office. — feed into は自動詞・他動詞の両方があるが、ここでは他動詞として受動態が自然
4 Our uniforms will soon (**dry out**) under the strong sun.
5 Due to the high increase in prices, we need to (**cut back on**) our household spending. — prices（物価）は複数

※教員PDFの U4-1 は `( soak up )` と表記。教科書は `will ( )` なので原形 soak up が正解。

### 本文の言い換え（教員スライド・ハンドアウトより）

- They let each of us express our unique sense of style. = to show our personalities / to express ourselves（They = clothes）
- while we're working out = while we're **exercising**
- to impress (**others**)（省略されている1語）
- to comfortably veg out on the couch = to (**relax**) on the couch（veg = vegetate の短縮形）
- express our unique sense of style ← (**non-verbal**) communication としての手段
- could be doing **even** more：even =「ずっと、はるかに」cf. much, far, a lot, still／衣服が①安全②快適③便利になるかもしれない
- aim to = try to
- keep their footing on slippery or uneven terrain = walk … without falling down
- war-torn countries = countries in conflict
- Not all advanced attire is designed to save lives = Some advanced attire is designed for saving lives, and others aren't
- layer up to stay warm = (**wear**) layers of clothes to stay warm
- On the flip side = On the (**other**) hand
- small enough for visible light waves to (**be**) (**blocked**), and big enough for infrared waves to (**pass**) (**through**) it
- have [**come up with**] incorporating completely new functions（been responsible for / given up は誤り）
- far from hitting retail racks：hit = **reach**
- retail の対義語 → **wholesale**（卸売り）
- demand for groundwater may rise = more groundwater may be needed
- climate change may intensify storms = more storms may occur
- the meager 1.2 percent = the small (**amount**) of 1.2 percent（meager ≒ only）
- Groundwater [**hidden** / made / lost] under mountains …（lurks と同等の動詞）
- lies underground：lie = exists の意味／beneath ≒ below
- quenches the thirst of = is also used as (**drinking**) water for／some = (**about**)
- trigger = **causing**
- What can be done? = What can we do?／Cutting back on = reduce

### 句動詞・熟語リスト
work out, veg out, dream up, keep one's footing, layer up, on the flip side, come up with, sew into, soak up, on the go, build up, be fashioned into, far from ～ing, break down, embed with, pass through, turn A into B, leak out, feed into, dry out, cut back (on), flush out, seep down into, go around

---

## 8. Step3 — 文法・構文（130問）

**教員が授業で取り上げた点だけを出す。** 出典は教員の解説スライドとハンドアウトの発問。

| 文法事項 | 本文の例 | 数 |
|---|---|---|
| **could の用法**（「使おうと思えばそのような効果が期待できる」仮定法的な could。なぜ can ではないか。ハンドアウト #1 Q4：まだ研究段階で実用化されたものが少ないから） | A new fabric coating, meanwhile, **could** absorb … | 10 |
| **let/help + O + 原形** | They **let each of us express** …／help people keep their footing | 8 |
| **過去分詞の後置修飾** | Fabric **embedded with** nanowires（ナノワイヤーを埋め込んである布地：自然な日本語は受動態にならないことが多い）／solar panels **sewn into** fabric | 10 |
| **接続詞＋過去分詞（S+be の省略）** | when (**they are**) bent or flexed／when (**they are**) squeezed or twisted（ハンドアウト #3 Q20）／if (they are) sewn into fabric | 10 |
| **ハイフンでつなぐ複合形容詞** | pop-out, metal-organic, war-torn, Tokyo-based, data-packed, hands-free, quick-drying, cutting-edge | 8 |
| 不規則動詞の活用 | sew-sewed-sewn, dream-dreamt-dreamt, bend-bent-bent | 8 |
| **部分否定 Not all** ＋ 他の否定語（few, none, nothing, hardly, barely, scarcely） | **Not all** advanced attire is designed to save lives | 10 |
| **比較級の強調 even**（much, far, a lot, still） | could be doing **even** more | 6 |
| **enough for ～ to do** | small enough for visible light waves to be blocked | 6 |
| **倍数表現** X times as much ～ as ／ X times more ～ than ／ X times the amount of ～（名詞を使った比較表現） | about 60 times as much water as …／200 times as much groundwater … as oil | 12 |
| **倒置 So do S**（「〜もまたそうだ」） | **So do** chemicals that are injected … = Chemicals also pollute groundwater | 8 |
| **As ＝ 〜するにつれて** | **As** human-caused climate change dries out …／**As** groundwater stores dwindle | 8 |
| **分詞構文**（threatening の意味上の主語＝直前の内容全体） | …, **threatening** freshwater ecosystems | 6 |
| **SVOC**（dry は the ground の補語。sucking の目的語ではない） | sucking the ground **dry** | 6 |
| 文頭の数字はアルファベットで綴る | **Twenty-one** of Earth's 37 biggest aquifers | 4 |
| 対比の談話標識 meanwhile / on the flip side / while（何と何を対比しているか） | While some fabrics help charge devices, others could serve as devices themselves | 6 |
| 同語反復の回避（clothes/apparel/attire/garment/clothing/outfit） | ハンドアウト #3 Q26 | 4 |
| **関係代名詞で定義を作る**（item + category + 関係詞 + features） | Groundwater is liquid freshwater **that** lies underground | 8 |

`Of that, nearly 69 percent …` の `that` ＝直前の about 2.5 percent of the planet's water（指示語問題として Step4 でも可）。

### Writing Strategy（並べ替え）4問 → **`sort` 型**＋各2問の類題

**U3-1** 東京に本拠を置く会社が、飛び出すスパイクを埋め込んだ靴底を開発した。
A **Tokyo-based company developed pop-out shoe soles with spikes** embedded in them.（過去分詞の後置修飾）
**U3-2** もしも、柔軟性のあるソーラーパネルを布地に織り込むならば、発電ができるだろう。
Flexible solar panels **could generate electricity if sewn into fabric**.（主語と be動詞の省略）
**U4-1** 帯水層が小さくなって、川や湖に十分な水を供給しないならば、水の生態系は脅かされるだろう。
Freshwater ecosystems could be threatened **if dwindling aquifers don't feed enough water into** the rivers and lakes.
**U4-2** 地球の帯水層にはたくさんの水がある。実際、そこには、湖と川を合わせたよりもおよそ60倍多くの水がある。
Earth's aquifers contain lots of freshwater. In fact, **they hold approximately 60 times more water than** the rivers and lakes combined.

`sort` 型の仕様は `.claude/skills/test-creation-workflow.md` と `js/quiz-engine.js` を読んで確認すること。

---

## 9. Step4 — 本文理解・ハンドアウト・Debate（300問）【自由枠】

| セクション | 形式 | 数 | 備考 |
|---|---|---|---|
| **In-Depth Review（教科書そのまま）** | single | 8 | 下の解答キー |
| **T/F Questions**（英語） | single（"True"/"False"） | 80 | 各段落から。**数値・固有名詞の入れ替え**で False を作る |
| **Question & Answer**（英語の質問→英語の答え） | single | 50 | Wh 疑問文。ハンドアウトの Grasp the Main Idea を含む |
| **Definition → 本文中の語**（本番形式） | single 25 ＋ input＋exact 15 | 40 | リスト外の語も。例：`buried bodies of water held in tiny gaps between rocks and soil grains` → aquifers |
| **ハンドアウトの発問**（Unit 3 #1〜#3、Unit 4 #1〜#2） | single | 45 | 手書き解答を**本文で検証してから**採用 |
| **数値・事実** | single | 20 | 下の表 |
| **Debate** | single / sort | 40 | 下記 |
| **fact / opinion 判定** | single | 17 | 新しい文も作る |

### In-Depth Review 解答キー（Opus が本文と照合）

**U3 Part 1**
1 ( ) is used to produce a wearable layer of protection from harmful chemicals. → (**a**) A metal-organic framework
2 Nanowires in the new fabric are expected to ( ). → (**b**) keep the wearers warm by using their body heat
**U3 Part 2**
1 Triboelectric materials and piezoelectric materials help the researchers ( ). → (**b**) develop self-powered outfits
2 It is expected that ( ) in future. → (**c**) the newly developed fabrics with various functions will go on the market
**U4 Part 1**
1 Groundwater ( ). → (**b**) is hidden from view
2 People can use groundwater to ( ). → (**b**) produce our food
**U4 Part 2**
1 Data from satellites reveal that ( ). → (**c**) some aquifers are getting smaller
2 The decrease in the amount of groundwater ( ). → (**a**) damages freshwater ecosystems

### 数値・事実

| 事実 | 値 |
|---|---|
| 地球の水のうち淡水 | about 2.5 percent（→ 海水は約 97.5%） |
| そのうち氷河・氷冠 | nearly 69 percent |
| そのうち地下水 | about 30 percent |
| 川と湖 | the meager 1.2 percent |
| 帯水層の水量 | about **60 times** as much water as the world's lakes and rivers combined |
| 地下水の採取量 | more than **200 times** as much groundwater as oil every year |
| 地下水で渇きをいやす人数 | some **2 billion** people（some ＝ about） |
| 米国人口の | half（約 170 million。米国人口は約 340 million で India・China に次ぐ3位） |
| 縮小している帯水層 | **Twenty-one of Earth's 37** biggest aquifers（satellite data） |
| 地下水が見られる場所 | under mountains, plains and even deserts |
| 最も干上がった帯水層の場所 | near big cities, farms, or arid regions |
| 小さな地震 | In **California**, sucking the ground dry may even be triggering small earthquakes |
| 地下水汚染の3要因 | Arsenic from farming or mining／chemicals injected underground (fracking)／electronic waste from discarded devices and sewage |
| U3 の研究例 | stitched conductive thread into a t-shirt → antenna that sends signals to a smartphone／magnetized copper and silver to write data into fabrics → hands-free key or form of ID |
| 語数 | U3：475 words ／ U4：425 words |

**教員スライドの注記**：「60 times」について「**25 times の誤記らしい**」（30% ÷ 1.2% = 25）。
→ **問題は本文どおり 60 times で作る。** 解説にだけ「計算上は約25倍になる、と先生が指摘」と書く。

### Debate（`Debate #1` ＋ `How to Express Your Opinions #1`）

**一般的な流れ（sort で順番を問う）**
肯定側立論 → 否定側立論 → 作戦タイム → **否定側反駁** → 肯定側反駁 → 作戦タイム → 肯定側まとめ → 否定側まとめ → 判定
**※反駁だけ否定側からスタートする**（引っかけに使う）

| 段階 | 英語 | 順番 | 時間 | 内容 |
|---|---|---|---|---|
| ①立論 | Constructive Speech | 肯定側→否定側 | 各5分程度（質疑応答含む） | テーマに対するチームの主張を述べ根拠を示す：1 チームの立場を明確に 2 主張の根拠を具体的に 3 自分たちの立場をもう一度 |
| ②第一反駁 | Rebuttal Speech | **否定側→肯定側** | 各5分程度（質疑応答含む） | 相手の主張に反論し自分たちの主張を守る：1 まず相手チームの主張を要約 2 反論を開始 3 自分たちの立場を再度主張 |
| ③第二反駁・まとめ | Summary Speech | 肯定側→否定側 | 各2分程度 | それぞれの議論を要約しつつ自分たちの主張が優位であることを訴える |
| ④判定 | Judgement | | | |

**ディベートとは**：あるテーマについて肯定側（the affirmative side）と否定側（the negative side）の2チームに分かれて行う試合形式の討論／**自分の意見とは関係なく**クジなどで担当チームが決まる／決まった時間・順番で発言し、最終的にジャッジ（審判：Judge）を納得させた方が勝ち／どれだけ説得力のある議論ができるかがポイント

**注意点（4つ）**：ディベートは**論理的思考**を求められる活動／相手を言い負かすのではなく、**客観的なデータや理由**を使って第三者（ジャッジ）を説得する論理的なゲーム／**チームメイトや相手チームの意見を尊重する**ことも大切／チーム一丸となって論題に取り組む

**fact と opinion**
- **A fact** is something which can be **proven** to be true or correct → **evidence-supported / unarguable [undisputable]**
- **An opinion** is what someone **thinks or believes**. It **cannot be proved** to be correct [true] or incorrect [false] → **personal / arguable / emotional**
- Examples：A "It's raining now." → "I can look outside and check it is true." = **fact** ／ B "It's going to rain later." → "I think it will rain, but I can't be sure." = **opinion** ／ C "Smoking is bad for our health." → "There is a lot of medical evidence to prove it." = **fact** ／ D "Smoking is relaxing." → "I think so, but other people might disagree." = **opinion**
- Exercise 1：1 Shohei Ohtani is the greatest baseball player of all time.＝opinion ／ 2 She woke up at 7:00 this morning.＝fact ／ 3 He speaks English very well.＝opinion ／ 4 The blue whale is the largest mammal on Earth.＝fact ／ 5 Mint chocolate chip ice cream tastes terrible.＝opinion
- 意見を述べるときの表現："Facts" でないのであれば断定することを避けるために **may, can などの助動詞**を使うとよい。I think / I believe / feel / know that ／ I guess that（根拠があまりなく推測する場合）／ In my opinion（主張する内容）／ From my point of view ／ I am certain / sure that ／ It seems to me that（断定を避ける場合に用いる seem）／ I agree [disagree] that … (for the following reasons) ／ I agree [disagree] with the idea that ／ There are (three, four, several) reasons for this ／ For these reasons ／ I am sure that（確信している場合）／ The good [bad] thing about ～ is that ／ Everyone should …

**Brain Storming Sheet #2 は本人の個人メモなので中身を出題しない。** 用語（Proposition, Affirmative/Negative side, Constructive/Rebuttal Speech）だけ使ってよい。

---

## 10. 本文内容解説ページ `eigo-honbun.html`

### 著作権上の制約（必ず守る）

本文は市販教科書の著作物で、サイトは公開されている。**本文を段落ごとに通しで全文掲載しない。**
利用者は教科書を持っている前提で「**行番号 [L.xx] で教科書を参照しながら読むページ**」にする。

各段落につき：
1. **要旨**（日本語2〜3文）
2. **押さえる文**：試験で問われそうな文を**1〜2文だけ**引用し、和訳と構文解説
3. **語注**（その段落の重要語）
4. **教員の発問と答え**（ハンドアウト・解説スライドから）
5. **狙われ方**（T/F・Q&A・definition のどれで出そうか）

構成：Unit 3（Part 1 ¶1–4、Part 2 ¶5–7）→ Unit 4（Part 1 ¶1–4、Part 2 ¶5–8）→ Debate まとめ → fact/opinion まとめ

**版面の規則（制御工学ページの反省）**
- 解説文が主役。本文 `.95rem` 以上、色 `var(--ink)`。灰色の小さい文字で説明しない
- 横並びにしない。1段落＝1カード
- 「気づく」「明らかに」「〜すればよい」を使わない
- `theme.css` の `:root` を汚染しない。`appShell.mount` で共通ヘッダー＋☰メニュー（`ouyoubutsuri-notes.html` と同じ作り）
- 各段落カードの末尾に、Step4 の該当セクションへのリンク
- `tests/_legacy.json` に登録：
  ```json
  { "year": 2026, "grade": 4, "exam": "前期末試験", "subject": "科学技術英語Ⅰ",
    "title": "科学技術英語Ⅰ ・ 本文内容解説", "storageKey": null, "totalItems": 0,
    "type": "summary", "path": "/eigo-honbun.html" }
  ```

---

## 11. 全テスト共通

- 全問に `note`（解説）。**なぜ他の選択肢が違うか**を1行
- 選択肢に自前の番号（①② や A.）を付けない（`prepareQuestions` のシャッフル仕様）
- True/False も `single`。選択肢は `"True"`, `"False"`
- 範囲外（**Summary、Approaching the Contents、Over to you!**）を出さない
- 1問に紛らわしい選択肢は2つまで
- **問題数の目安を下回らないこと。**「とにかく大量に」が利用者の要望
- `research/findings/short-term-exam-prep.json` に「産出（スペル）は産出練習でしか伸びない」の finding を追加し、`implemented_in` に vocabtest4 と step1、`research/index.json` を更新（**セッションAのみ**）

## 12. 並列実行のルール（3セッション同時）

- **自分の担当ファイル以外に触らない。** 特に `js/quiz-engine.js`（Aのみ）、`tests/_legacy.json` と `eigo-honbun.html`（Cのみ）、`research/`（Aのみ）
- コミットは**自分のファイルだけを `git add <path>` で指定**。`git add -A` / `git add .` 禁止
- プッシュ前に `git pull --rebase origin main`
- 検証は静的配信（`server.js` はDB必須で起動しない）。**ポートをセッションごとに変える**（A:8201 B:8202 C:8203）
- 他セッションに委任しない。自分で手を動かす

## 13. 確認

- 全問表示、正解位置 A/B/C/D の分布に偏りなし（JSで数える）
- `index.html` の前期末試験・科学技術英語Ⅰの並びに出る。☰メニューから到達できる
- **Aのみ**：`input`＋`exact` の問題で `currently` と打つと `current` が**不正解**、空欄も不正解、既存の `tests/2026-4-zenki-chukan-eigo` の input 問題は従来どおり判定されることを実際に入力して確認
