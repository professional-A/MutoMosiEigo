const express = require('express');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function genSalt()  { return crypto.randomBytes(16).toString('hex'); }
function genToken() { return crypto.randomBytes(32).toString('hex'); }
function hashPw(pw, salt) { return crypto.pbkdf2Sync(pw, salt, 100000, 64, 'sha512').toString('hex'); }
// JST 5:00 AM でリセット（UTC+4h オフセットで計算）
function bonusDay() { return new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10); }
function dp(u) { return (u.points || 0) + (u.test_bet || 0); } // 累計ポイント（賭け中含む）
function dsp(u) { return u.season_points || 0; }               // シーズンポイント

// 称号オーバーライド（DB値より優先）
function applyTitleOverride(u) {
  if (u && u.username === '福澤') { u.title = 'おっぱいラーメン'; u.title_class = 'title-masami'; }
  return u;
}

let siteLocked = false; // 管理者によるアクセス制限フラグ
let scoreInputLocked = false; // 得点入力締め切りフラグ
let registrationLocked = false; // 新規登録制限フラグ

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000, statement_timeout: 20000 });
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

app.use(express.json());

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          SERIAL PRIMARY KEY,
      supabase_id TEXT UNIQUE,
      username    TEXT NOT NULL,
      email       TEXT,
      avatar      TEXT DEFAULT '🐸',
      frame       TEXT DEFAULT 'default',
      created_at  TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS scores (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      score      INTEGER NOT NULL,
      total      INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS class_ranking (
      position     INTEGER PRIMARY KEY,
      student_name TEXT,
      updated_by   TEXT,
      updated_at   TEXT
    );
    CREATE TABLE IF NOT EXISTS class_rank_state (
      id        INTEGER PRIMARY KEY DEFAULT 1,
      ordered   TEXT DEFAULT '[]',
      confirmed TEXT DEFAULT '{}'
    );
    INSERT INTO class_rank_state (id) VALUES (1) ON CONFLICT DO NOTHING;
  `).catch(()=>{});
  await pool.query(`ALTER TABLE class_rank_state ADD COLUMN IF NOT EXISTS max_score INTEGER DEFAULT 300`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_id TEXT`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email       TEXT`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar      TEXT DEFAULT '🐸'`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS frame       TEXT DEFAULT 'default'`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at  TEXT DEFAULT ''`).catch(()=>{});
  await pool.query(`ALTER TABLE users ALTER COLUMN password DROP NOT NULL`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS points        INTEGER DEFAULT 0`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS season_points INTEGER DEFAULT 0`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login   TEXT DEFAULT ''`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_salt TEXT`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS session_token TEXT`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS test_pred  INTEGER`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS test_score INTEGER`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS test_bet   INTEGER`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS prev_frame TEXT DEFAULT 'default'`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS unlocked_avatars TEXT DEFAULT '[]'`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'ちょおちょおちょお'`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS title_class TEXT`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ouri_score       INTEGER`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS math_score       INTEGER`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS kakougaku_score  INTEGER`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS nekku_score      INTEGER`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS seigyo_score     INTEGER`).catch(()=>{});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS exam_schedule (
      id            SERIAL PRIMARY KEY,
      subject       TEXT NOT NULL,
      exam          TEXT NOT NULL,
      archive_after TEXT,
      UNIQUE(subject, exam)
    )
  `).catch(()=>{});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS banners (
      id         SERIAL PRIMARY KEY,
      date       TEXT,
      title      TEXT NOT NULL,
      body       TEXT NOT NULL,
      is_new     BOOLEAN DEFAULT true,
      created_at TEXT DEFAULT ''
    )
  `).catch(()=>{});
  await pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`).catch(()=>{});
  await pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS author TEXT`).catch(()=>{});
  await pool.query(`ALTER TABLE battles ADD COLUMN IF NOT EXISTS race_id INTEGER REFERENCES races(id) ON DELETE SET NULL`).catch(()=>{});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS battles (
      id         SERIAL PRIMARY KEY,
      subject    TEXT NOT NULL,
      p1_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
      p2_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
      p1_bet     INTEGER DEFAULT 0,
      p2_bet     INTEGER DEFAULT 0,
      winner_id  INTEGER REFERENCES users(id),
      status     TEXT DEFAULT 'open',
      created_at TEXT DEFAULT ''
    )
  `).catch(()=>{});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS battle_bets (
      id         SERIAL PRIMARY KEY,
      battle_id  INTEGER NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      side       INTEGER NOT NULL,
      amount     INTEGER NOT NULL DEFAULT 0,
      created_at TEXT,
      UNIQUE(battle_id, user_id)
    )
  `).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS class_rank TEXT DEFAULT '{}'`).catch(()=>{});
  await pool.query(`UPDATE users SET username='荒らし乙' WHERE username LIKE '%﷽%'`).catch(()=>{});
  // 個人称号を設定
  await pool.query(`UPDATE users SET title='ちょおちょおちょお', title_class='title-tanaka'  WHERE username='田中謙佑'`).catch(()=>{});
  await pool.query(`UPDATE users SET title='ほりきた',           title_class='title-hiroto'   WHERE username='高橋ヒロト'`).catch(()=>{});
  await pool.query(`UPDATE users SET title='多頭飼い',            title_class='title-hasegawa' WHERE username='はせがわ'`).catch(()=>{});
  await pool.query(`UPDATE users SET title='女使われ/こゆこゆ中…/寝落ち通話でイヤホン口の中', title_class='title-pro' WHERE username='professional-A'`).catch(()=>{});
  await pool.query(`UPDATE users SET title='ほんまごめん',       title_class='title-arashi'   WHERE username='荒らし乙'`).catch(()=>{});
  await pool.query(`UPDATE users SET title='俺は〇〇をい〇めたい', title_class='title-eye'   WHERE username LIKE '%ꙮ%'`).catch(()=>{});
  await pool.query(`UPDATE users SET title='ハンタウイルス',     title_class='title-hatano'   WHERE username='波多野裏技'`).catch(()=>{});
  await pool.query(`UPDATE users SET title='じゃあいいよぉもう', title_class='title-honari'  WHERE username='honari'`).catch(()=>{});
  await pool.query(`UPDATE users SET title='そもそもそんなこと言ってるけど、', title_class='title-mitts' WHERE username='ミッツ'`).catch(()=>{});
  await pool.query(`UPDATE users SET title='ママぁ～',           title_class='title-kawakami' WHERE username='川上晃弥'`).catch(()=>{});
  await pool.query(`UPDATE users SET title=NULL, title_class=NULL WHERE username IN ('honari2','seijuro_dummy')`).catch(()=>{});
  await pool.query(`UPDATE users SET title='おっぱいラーメン', title_class='title-masami' WHERE username='福澤'`).catch(()=>{});
  await pool.query(`UPDATE users SET ouri_score=36 WHERE username='波多野裏技' AND (ouri_score IS NULL OR ouri_score=0)`).catch(()=>{});
  await pool.query(`DELETE FROM users WHERE username='honari2'`).catch(()=>{});
  await pool.query(`UPDATE users SET title='当麻村の中学生', title_class='title-shimesaba' WHERE username='SHIMESABA'`).catch(()=>{});
  await pool.query(`UPDATE users SET title='喋んな触んなきもちわりー', title_class='title-ya' WHERE username='やー'`).catch(()=>{});
  await pool.query(`UPDATE users SET title='膝枕/ゆずのおっぱいをもむことだぁ/足長ノッポ手足長病メガネラーメン', title_class='title-masami' WHERE username='福澤'`).catch(()=>{});
  await pool.query(`UPDATE users SET title='ひざまくら',          title_class='title-yoshi'    WHERE username='よしよしぎゅー'`).catch(()=>{});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quiz_progress (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      quiz_key   TEXT NOT NULL,
      state_json TEXT NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, quiz_key)
    )
  `).catch(()=>{});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quiz_answers (
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      answer_key TEXT NOT NULL,
      subject    TEXT NOT NULL DEFAULT '',
      awarded_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, answer_key)
    )
  `).catch(()=>{});
  await pool.query(`ALTER TABLE quiz_answers ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT ''`).catch(()=>{});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `).catch(()=>{});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS survey_responses (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      answers    JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(()=>{});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS races (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      start_date TEXT DEFAULT '',
      end_date   TEXT DEFAULT '',
      active     INTEGER DEFAULT 1,
      created_at TEXT DEFAULT '',
      subject    TEXT DEFAULT '',
      status     TEXT DEFAULT 'active'
    )
  `).catch(()=>{});
  await pool.query(`ALTER TABLE races ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT ''`).catch(()=>{});
  await pool.query(`ALTER TABLE races ADD COLUMN IF NOT EXISTS status  TEXT DEFAULT 'active'`).catch(()=>{});
  await pool.query(`ALTER TABLE race_study_log ADD COLUMN IF NOT EXISTS muto_minutes INTEGER DEFAULT 0`).catch(()=>{});
  await pool.query(`ALTER TABLE race_study_log ADD COLUMN IF NOT EXISTS muto_tool    TEXT    DEFAULT ''`).catch(()=>{});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS race_pairs (
      id      SERIAL PRIMARY KEY,
      race_id INTEGER REFERENCES races(id) ON DELETE CASCADE,
      name    TEXT NOT NULL DEFAULT 'ペア'
    )
  `).catch(()=>{});
  await pool.query(`ALTER TABLE race_pairs ALTER COLUMN race_id DROP NOT NULL`).catch(()=>{});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS race_pair_members (
      pair_id INTEGER NOT NULL REFERENCES race_pairs(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(pair_id, user_id)
    )
  `).catch(()=>{});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS race_bets (
      id             SERIAL PRIMARY KEY,
      race_id        INTEGER NOT NULL REFERENCES races(id) ON DELETE CASCADE,
      user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount         INTEGER NOT NULL DEFAULT 0,
      UNIQUE(race_id, user_id)
    )
  `).catch(()=>{});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS race_groups (
      id      SERIAL PRIMARY KEY,
      race_id INTEGER NOT NULL REFERENCES races(id) ON DELETE CASCADE,
      name    TEXT NOT NULL
    )
  `).catch(()=>{});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS race_group_members (
      id       SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL REFERENCES race_groups(id) ON DELETE CASCADE,
      user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(group_id, user_id)
    )
  `).catch(()=>{});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS race_study_log (
      id             SERIAL PRIMARY KEY,
      race_id        INTEGER NOT NULL REFERENCES races(id) ON DELETE CASCADE,
      user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      auto_seconds   INTEGER DEFAULT 0,
      manual_minutes INTEGER DEFAULT 0,
      manual_tool    TEXT DEFAULT '',
      game_minutes   INTEGER DEFAULT 0,
      updated_at     TEXT DEFAULT '',
      UNIQUE(race_id, user_id)
    )
  `).catch(()=>{});
  // 福澤まさみ以外のワーストフレームをリセット
  await pool.query(`UPDATE users SET frame='default' WHERE frame='worst' AND username != '福澤まさみ'`).catch(()=>{});
  // 田中謙佑に誤付与されたワーストを修正してrainbowに
  await pool.query(`UPDATE users SET frame='rainbow' WHERE username='田中謙佑' AND frame IN ('worst','default')`).catch(()=>{});
  // アンケート完了済みユーザーのunlocked_avatarsに😼を追加（アバター変更後も対応）
  await pool.query(`UPDATE users SET unlocked_avatars='["😼"]' WHERE id IN (SELECT user_id FROM survey_responses) AND (unlocked_avatars='[]' OR unlocked_avatars IS NULL OR unlocked_avatars NOT LIKE '%😼%')`).catch(()=>{});
  // 全員に😏（あきとアイコン）をアンロック
  await pool.query(`UPDATE users SET unlocked_avatars = CASE WHEN unlocked_avatars IS NULL OR unlocked_avatars = '[]' THEN '["😏"]' WHEN unlocked_avatars NOT LIKE '%😏%' THEN REPLACE(unlocked_avatars, ']', ',"😏"]') ELSE unlocked_avatars END`).catch(()=>{});
}

// 1位に worst フレームを自動付与・外れたら prev_frame に戻す
async function syncWorstFrame() {
  try {
    const { rows: top } = await pool.query(
      'SELECT id FROM users ORDER BY points + COALESCE(test_bet,0) DESC LIMIT 1'
    );
    if (!top[0]) return;
    const topId = top[0].id;
    // 旧1位（worst持ち）からフレームを戻す
    const { rows: old } = await pool.query(
      "SELECT id, prev_frame FROM users WHERE frame='worst' AND id != $1", [topId]
    );
    for (const u of old) {
      await pool.query('UPDATE users SET frame=$1 WHERE id=$2', [u.prev_frame || 'default', u.id]);
    }
    // 新1位が worst でなければ prev_frame を保存してから worst を付与
    const { rows: cur } = await pool.query('SELECT frame FROM users WHERE id=$1', [topId]);
    if (cur[0] && cur[0].frame !== 'worst') {
      await pool.query('UPDATE users SET prev_frame=frame, frame=\'worst\' WHERE id=$1', [topId]);
    }
  } catch(e) {}
}

// 認証ミドルウェア（Supabase JWT または カスタムセッショントークン）
async function auth(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'ログインが必要です' });

  // Supabase JWT を試す
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (!error && user) {
      const { rows } = await pool.query('SELECT * FROM users WHERE supabase_id = $1', [user.id]);
      if (rows[0]) { req.user = rows[0]; return next(); }
    }
  } catch(e) {}

  // カスタムセッショントークンを試す
  const { rows } = await pool.query('SELECT * FROM users WHERE session_token = $1', [token]);
  if (rows[0]) { req.user = rows[0]; return next(); }

  return res.status(401).json({ error: 'トークンが無効です' });
}

// Googleログイン後にユーザー情報を同期 + 毎日ログインボーナス
app.post('/api/sync-user', async (req, res) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: '認証エラー' });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: '認証エラー' });

  const name  = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'ユーザー';
  const email = user.email || '';

  const { rows } = await pool.query('SELECT * FROM users WHERE supabase_id = $1', [user.id]);
  if (rows.length === 0) {
    if (registrationLocked) return res.status(403).json({ error: '現在、新規登録を受け付けていません' });
    await pool.query(
      'INSERT INTO users (supabase_id, username, email, created_at) VALUES ($1, $2, $3, $4)',
      [user.id, name, email, new Date().toISOString()]
    );
  }
  const { rows: r } = await pool.query('SELECT * FROM users WHERE supabase_id = $1', [user.id]);
  const u = r[0];

  // 毎日ログインボーナス（1000pt）
  const today = bonusDay();
  let loginBonus = 0;
  if (u.last_login !== today) {
    await pool.query('UPDATE users SET points = points + 1000, season_points = season_points + 1000, last_login = $1 WHERE id = $2', [today, u.id]);
    loginBonus = 1000;
  }

  const { rows: r2 } = await pool.query('SELECT * FROM users WHERE id = $1', [u.id]);
  const u2 = r2[0];
  res.json({ id: u2.id, username: u2.username, avatar: u2.avatar, frame: u2.frame, email: u2.email, points: dsp(u2), lifetime_points: dp(u2), loginBonus, unlockedAvatars: JSON.parse(u2.unlocked_avatars || '[]') });
});

// アバター・フレーム更新
app.put('/api/avatar', auth, async (req, res) => {
  const { avatar, frame, username } = req.body;
  if (!avatar) return res.status(400).json({ error: 'アバターが必要です' });
  const name = username?.trim() || req.user.username;
  await pool.query('UPDATE users SET avatar = $1, frame = $2, username = $3 WHERE id = $4', [avatar, frame || 'default', name, req.user.id]);
  res.json({ ok: true });
});

// ポイント加算（問題正解）— サーバー側重複防止
app.post('/api/points', auth, async (req, res) => {
  if (siteLocked) return res.status(423).json({ error: 'サイトがロック中のためポイントを加算できません' });
  const { amount, quizKey, questionKey, correct, subject } = req.body;

  // アクティブレースの教科を取得してシーズンpt加算可否を判定
  let addSeason = true;
  try {
    const { rows: races } = await pool.query("SELECT subject FROM races WHERE active=1 ORDER BY id DESC LIMIT 1");
    const raceSubject = races[0]?.subject;
    if (raceSubject && subject && raceSubject !== subject) addSeason = false;
  } catch(e) {}

  // quizKey/questionKey なし: シンプル加算（レガシー）
  if (!quizKey || !questionKey) {
    if (!Number.isInteger(amount) || amount <= 0 || amount > 200) return res.status(400).json({ error: '不正なポイント' });
    if (addSeason) {
      await pool.query('UPDATE users SET points = points + $1, season_points = season_points + $1 WHERE id = $2', [amount, req.user.id]);
    } else {
      await pool.query('UPDATE users SET points = points + $1 WHERE id = $2', [amount, req.user.id]);
    }
    const { rows } = await pool.query('SELECT points, test_bet, season_points FROM users WHERE id = $1', [req.user.id]);
    return res.json({ ok: true, points: dsp(rows[0]), lifetime_points: dp(rows[0]), delta: amount });
  }

  // dedup モード: 初回正解+amount / 復習正解+amount*20% / 初回不正解=0
  const answerKey = `${quizKey}:${questionKey}`;
  const { rows: ex } = await pool.query(
    'SELECT 1 FROM quiz_answers WHERE user_id=$1 AND answer_key=$2', [req.user.id, answerKey]
  );
  const isRepeat = ex.length > 0;
  const baseAmount = Number.isInteger(amount) && amount > 0 && amount <= 500 ? amount : 100;

  let delta = 0;
  if (!isRepeat) {
    if (correct !== false) {
      await pool.query('INSERT INTO quiz_answers (user_id, answer_key, subject) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [req.user.id, answerKey, subject || '']);
      delta = baseAmount;
    }
  } else {
    delta = correct !== false ? Math.round(baseAmount * 0.2) : 0;
  }

  if (delta !== 0) {
    if (addSeason) {
      await pool.query('UPDATE users SET points = GREATEST(0, points + $1), season_points = GREATEST(0, season_points + $1) WHERE id = $2', [delta, req.user.id]);
    } else {
      await pool.query('UPDATE users SET points = GREATEST(0, points + $1) WHERE id = $2', [delta, req.user.id]);
    }
    // ペア応援ボーナス: 同ペアに20%付与（season_ptのみ、レース教科フィルタ適用）
    if (addSeason) {
      const pairBonus = Math.round(delta * 0.2);
      if (pairBonus > 0) {
        const { rows: pairMembers } = await pool.query(
          `SELECT rpm.user_id FROM race_pair_members rpm
           WHERE rpm.pair_id IN (SELECT pair_id FROM race_pair_members WHERE user_id=$1)
             AND rpm.user_id != $1
             AND (SELECT race_id FROM race_pairs WHERE id=rpm.pair_id) IS NULL`,
          [req.user.id]
        );
        for (const pm of pairMembers) {
          await pool.query('UPDATE users SET season_points = season_points + $1 WHERE id = $2', [pairBonus, pm.user_id]);
        }
      }
    }
  }
  const { rows } = await pool.query('SELECT points, test_bet, season_points FROM users WHERE id = $1', [req.user.id]);
  res.json({ ok: true, points: dsp(rows[0]), lifetime_points: dp(rows[0]), delta });
  if (delta !== 0) syncWorstFrame();
});

// スコア保存
app.post('/api/score', auth, async (req, res) => {
  const { score, total } = req.body;
  const { rows } = await pool.query('SELECT * FROM scores WHERE user_id = $1', [req.user.id]);
  const now = new Date().toISOString();
  if (rows[0]) {
    await pool.query('UPDATE scores SET score = $1, total = $2, updated_at = $3 WHERE user_id = $4', [score, total, now, req.user.id]);
  } else {
    await pool.query('INSERT INTO scores (user_id, score, total, updated_at) VALUES ($1, $2, $3, $4)', [req.user.id, score, total, now]);
  }
  res.json({ ok: true });
});

// ランキング（同スコアは同順位）
app.get('/api/ranking', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT u.username, u.avatar, u.frame, s.score, s.total, s.updated_at,
           DENSE_RANK() OVER (ORDER BY s.score DESC) AS rank
    FROM scores s JOIN users u ON s.user_id = u.id
    ORDER BY s.score DESC
  `);
  res.json(rows);
});

// メンバー一覧（ポイント順、ログイン不要）
app.get('/api/members', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT username, avatar, frame, title, title_class,
           season_points,
           points + COALESCE(test_bet,0) AS lifetime_points,
           last_login, test_pred, test_bet, test_score,
           DENSE_RANK() OVER (ORDER BY season_points DESC) AS rank
    FROM users
    ORDER BY season_points DESC
  `);
  res.json(rows.map(applyTitleOverride));
});

// 科目別成績一覧（ログイン不要）
app.get('/api/scores', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT username, avatar, frame, title, test_score, ouri_score, math_score, kakougaku_score, nekku_score, seigyo_score
    FROM users
    ORDER BY username
  `);
  res.json(rows);
});

// 応用物理得点入力（自己申告・再入力可）
app.post('/api/ouri/score', auth, async (req, res) => {
  const s = parseInt(req.body.score, 10);
  if (isNaN(s) || s < 0 || s > 100) return res.status(400).json({ error: '0〜100で入力してください' });
  await pool.query('UPDATE users SET ouri_score=$1 WHERE id=$2', [s, req.user.id]);
  res.json({ ok: true, score: s });
});

// 応用数学得点入力（自己申告・再入力可）
app.post('/api/math/score', auth, async (req, res) => {
  const s = parseInt(req.body.score, 10);
  if (isNaN(s) || s < 0 || s > 100) return res.status(400).json({ error: '0〜100で入力してください' });
  await pool.query('UPDATE users SET math_score=$1 WHERE id=$2', [s, req.user.id]);
  res.json({ ok: true, score: s });
});

// 加工学得点入力
app.post('/api/kakougaku/score', auth, async (req, res) => {
  const s = parseInt(req.body.score, 10);
  if (isNaN(s) || s < 0 || s > 100) return res.status(400).json({ error: '0〜100で入力してください' });
  await pool.query('UPDATE users SET kakougaku_score=$1 WHERE id=$2', [s, req.user.id]);
  res.json({ ok: true, score: s });
});

// 熱流体工学Ⅰ得点入力
app.post('/api/nekku/score', auth, async (req, res) => {
  const s = parseInt(req.body.score, 10);
  if (isNaN(s) || s < 0 || s > 100) return res.status(400).json({ error: '0〜100で入力してください' });
  await pool.query('UPDATE users SET nekku_score=$1 WHERE id=$2', [s, req.user.id]);
  res.json({ ok: true, score: s });
});

// 制御工学Ⅰ得点入力
app.post('/api/seigyo/score', auth, async (req, res) => {
  const s = parseInt(req.body.score, 10);
  if (isNaN(s) || s < 0 || s > 100) return res.status(400).json({ error: '0〜100で入力してください' });
  await pool.query('UPDATE users SET seigyo_score=$1 WHERE id=$2', [s, req.user.id]);
  res.json({ ok: true, score: s });
});

// アプリユーザー → クラス順位コマ対応表
const USER_CLRANK_MAP = {
  '福澤':          'まさみ',
  'professional-A':'むとう',
  'はせがわ':      'ひろと',
  'やー':          'けんすけ',
  '荒らし乙':      'しょう',
  'ちんこうや':    'こうや',
  'SHIMESABA':     'りょうすけ',
  'ミッツ':        'みっつー',
  'えむししょ':    'しょうた',
  '波多野裏技':    'はたの',
  'honari':        'ほなり',
  'seijuro_dummy': 'せいじゅうろう',
};

// クラス順位（全員共有）
app.get('/api/class-rank', async (req, res) => {
  const { rows } = await pool.query('SELECT ordered, confirmed, max_score FROM class_rank_state WHERE id=1');
  if (!rows.length) return res.json({ positions: {}, confirmed: {}, max_score: 300 });
  let positions = {};
  try { const p = JSON.parse(rows[0].ordered || '{}'); if (!Array.isArray(p)) positions = p; } catch(e) {}
  const conf = JSON.parse(rows[0].confirmed || '{}');
  // 入力済み教科数 × 100 を満点として自動算出
  let autoMaxScore = 100;
  try {
    const { rows: sc } = await pool.query(`
      SELECT
        (COUNT(*) FILTER (WHERE test_score       IS NOT NULL)) > 0 AS has_test,
        (COUNT(*) FILTER (WHERE ouri_score       IS NOT NULL)) > 0 AS has_ouri,
        (COUNT(*) FILTER (WHERE math_score       IS NOT NULL)) > 0 AS has_math,
        (COUNT(*) FILTER (WHERE kakougaku_score  IS NOT NULL)) > 0 AS has_kakougaku,
        (COUNT(*) FILTER (WHERE nekku_score      IS NOT NULL)) > 0 AS has_nekku,
        (COUNT(*) FILTER (WHERE seigyo_score     IS NOT NULL)) > 0 AS has_seigyo
      FROM users
    `);
    const s = sc[0];
    autoMaxScore = ([s.has_test, s.has_ouri, s.has_math, s.has_kakougaku, s.has_nekku, s.has_seigyo].filter(Boolean).length) * 100 || 100;
  } catch(e) {}
  // ユーザー紐づけ：全入力済みの人を確定点に自動反映
  try {
    const usernames = Object.keys(USER_CLRANK_MAP);
    const { rows: urows } = await pool.query(
      'SELECT username, test_score, ouri_score, math_score, kakougaku_score, nekku_score FROM users WHERE username = ANY($1)',
      [usernames]
    );
    for (const u of urows) {
      if (u.test_score != null && u.ouri_score != null && u.math_score != null && u.kakougaku_score != null && u.nekku_score != null) {
        conf[USER_CLRANK_MAP[u.username]] = u.test_score + u.ouri_score + u.math_score + u.kakougaku_score + u.nekku_score;
      }
    }
  } catch(e) {}
  res.json({ positions, confirmed: conf, max_score: autoMaxScore });
});
app.post('/api/class-rank', auth, async (req, res) => {
  const { positions } = req.body;
  if (!positions || typeof positions !== 'object' || Array.isArray(positions)) return res.status(400).json({ error: '不正なデータ' });
  const cleaned = {};
  for (const [name, pos] of Object.entries(positions)) {
    if (name && typeof pos === 'object' && typeof pos.x === 'number' && typeof pos.y === 'number')
      cleaned[name.trim().slice(0,20)] = { x: Math.max(0,Math.min(100,pos.x)), y: Math.max(0,Math.min(100,pos.y)) };
  }
  await pool.query(
    'INSERT INTO class_rank_state (id, ordered) VALUES (1,$1) ON CONFLICT (id) DO UPDATE SET ordered=$1',
    [JSON.stringify(cleaned)]
  );
  res.json({ ok: true });
});
app.post('/api/class-rank/max-score', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  const ms = parseInt(req.body.max_score);
  if (!ms || ms < 1 || ms > 1000) return res.status(400).json({ error: '無効な値' });
  await pool.query(
    'INSERT INTO class_rank_state (id, max_score) VALUES (1,$1) ON CONFLICT (id) DO UPDATE SET max_score=$1',
    [ms]
  );
  res.json({ ok: true });
});
app.post('/api/class-rank/confirm', auth, async (req, res) => {
  const { name, total } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '無効な名前' });
  const { rows } = await pool.query('SELECT confirmed FROM class_rank_state WHERE id=1');
  const conf = JSON.parse(rows[0]?.confirmed || '{}');
  if (Number.isInteger(total) && total > 0) conf[name.trim()] = total;
  else delete conf[name.trim()];
  await pool.query(
    'INSERT INTO class_rank_state (id, confirmed) VALUES (1,$1) ON CONFLICT (id) DO UPDATE SET confirmed=$1',
    [JSON.stringify(conf)]
  );
  res.json({ ok: true });
});

// 管理者：ユーザー一覧
app.get('/api/admin/users', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  const { rows } = await pool.query(`
    SELECT u.id, u.username, u.email, u.avatar, u.frame, u.created_at,
           u.points + COALESCE(u.test_bet,0) AS points, s.score, s.total,
           u.test_pred, u.test_bet
    FROM users u LEFT JOIN scores s ON s.user_id = u.id
    ORDER BY u.points + COALESCE(u.test_bet,0) DESC
  `);
  res.json(rows);
});

// 自分の情報を取得（パスワードユーザーの再ログイン用）
app.get('/api/me', auth, async (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, avatar: req.user.avatar, frame: req.user.frame, email: req.user.email || '', points: dsp(req.user), lifetime_points: dp(req.user), unlockedAvatars: JSON.parse(req.user.unlocked_avatars || '[]'), title: req.user.title || 'ちょおちょおちょお', ouriScore: req.user.ouri_score ?? null });
});

// パスワード登録
app.post('/api/register', async (req, res) => {
  if (registrationLocked) return res.status(403).json({ error: '現在、新規登録を受け付けていません' });
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'ユーザー名とパスワードが必要です' });
  if (username.length < 2 || username.length > 20) return res.status(400).json({ error: 'ユーザー名は2〜20文字で' });
  if (password.length < 4) return res.status(400).json({ error: 'パスワードは4文字以上で' });

  const { rows: ex } = await pool.query('SELECT id FROM users WHERE username=$1 AND supabase_id IS NULL', [username]);
  if (ex.length > 0) return res.status(400).json({ error: 'このユーザー名はすでに使われています' });

  const salt  = genSalt();
  const hash  = hashPw(password, salt);
  const token = genToken();
  const today = bonusDay();

  await pool.query(
    'INSERT INTO users (username, password_hash, password_salt, session_token, points, last_login, created_at) VALUES ($1,$2,$3,$4,1000,$5,$6)',
    [username, hash, salt, token, today, new Date().toISOString()]
  );
  const { rows } = await pool.query('SELECT * FROM users WHERE session_token=$1', [token]);
  const u = rows[0];
  res.json({ token, username: u.username, avatar: u.avatar, frame: u.frame, points: dsp(u), lifetime_points: dp(u), loginBonus: 1000, unlockedAvatars: JSON.parse(u.unlocked_avatars || '[]') });
});

// パスワードログイン
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'ユーザー名とパスワードが必要です' });

  const { rows } = await pool.query('SELECT * FROM users WHERE username=$1 AND password_hash IS NOT NULL', [username]);
  if (!rows[0]) return res.status(401).json({ error: 'ユーザー名かパスワードが違います' });

  const u = rows[0];
  if (hashPw(password, u.password_salt) !== u.password_hash) return res.status(401).json({ error: 'ユーザー名かパスワードが違います' });

  const token = genToken();
  const today = bonusDay();
  let loginBonus = 0;
  if (u.last_login !== today) {
    await pool.query('UPDATE users SET points=points+1000, season_points=season_points+1000, last_login=$1 WHERE id=$2', [today, u.id]);
    loginBonus = 1000;
  }
  await pool.query('UPDATE users SET session_token=$1 WHERE id=$2', [token, u.id]);
  const { rows: r } = await pool.query('SELECT * FROM users WHERE id=$1', [u.id]);
  const u2 = r[0];
  res.json({ token, username: u2.username, avatar: u2.avatar, frame: u2.frame, points: dsp(u2), lifetime_points: dp(u2), loginBonus, unlockedAvatars: JSON.parse(u2.unlocked_avatars || '[]') });
});

// ── テストイベント ──────────────────────────────────────
const PRED_DEADLINE = new Date('2026-06-16T00:00:00Z'); // JST 9:00 AM

app.get('/api/test/me', auth, async (req, res) => {
  res.json({ test_pred: req.user.test_pred, test_score: req.user.test_score, test_bet: req.user.test_bet });
});

// プールの現在合計を返す（ログイン不要）
app.get('/api/test/pool', async (req, res) => {
  const { rows } = await pool.query('SELECT COALESCE(SUM(test_bet),0) AS total FROM users WHERE test_bet IS NOT NULL');
  res.json({ total: Number(rows[0].total) });
});

app.post('/api/test/predict', auth, async (req, res) => {
  if (new Date() > PRED_DEADLINE) return res.status(400).json({ error: '予測の受付は終了しました（6/16 9:00 AM）' });
  if (req.user.test_score != null) return res.status(400).json({ error: '得点登録済みのため変更できません' });
  const { prediction, bet } = req.body;
  if (prediction == null || prediction < 0 || prediction > 100) return res.status(400).json({ error: '予測は0〜100で入力してください' });
  const betAmt = parseInt(bet, 10);
  if (!betAmt || betAmt < 100) return res.status(400).json({ error: '賭け金は100pt以上にしてください' });
  // 旧賭け金を返金してから新賭け金を引く
  const oldBet = req.user.test_bet || 0;
  const netChange = betAmt - oldBet; // 正=追加引き落とし、負=返金
  const newPoints = req.user.points - netChange;
  if (newPoints < 0) return res.status(400).json({ error: 'ポイントが足りません' });
  await pool.query('UPDATE users SET test_pred=$1, test_bet=$2, points=$3 WHERE id=$4', [prediction, betAmt, newPoints, req.user.id]);
  res.json({ ok: true, points: newPoints + betAmt }); // 表示は賭け中含む
});

app.post('/api/test/score', auth, async (req, res) => {
  if (scoreInputLocked) return res.status(423).json({ error: '得点入力は締め切られました' });
  const { score } = req.body;
  if (score == null || score < 0 || score > 100) return res.status(400).json({ error: '0〜100で入力してください' });
  await pool.query('UPDATE users SET test_score=$1 WHERE id=$2', [score, req.user.id]);
  const { rows } = await pool.query('SELECT points, test_bet FROM users WHERE id=$1', [req.user.id]);
  res.json({ ok: true, points: dp(rows[0]) });
});

app.get('/api/test/results', auth, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT username, avatar, frame, test_pred, test_score, test_bet
    FROM users WHERE test_score IS NOT NULL
    ORDER BY test_score ASC
  `);
  res.json(rows);
});


// ポイント1位にワーストフレーム付与（手動トリガー）
app.post('/api/admin/award-worst', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  await syncWorstFrame();
  const { rows } = await pool.query("SELECT username FROM users WHERE frame='worst' LIMIT 1");
  res.json({ ok: true, username: rows[0]?.username });
});

// テスト平均点下位3人にフレーム付与（1科目以上入力済みの人が対象）
app.post('/api/admin/award-baka', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  const { rows } = await pool.query(`
    SELECT id, username,
      (COALESCE(test_score,0) + COALESCE(ouri_score,0) + COALESCE(math_score,0) + COALESCE(kakougaku_score,0) + COALESCE(nekku_score,0))::float /
      (CASE WHEN test_score       IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN ouri_score       IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN math_score       IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN kakougaku_score  IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN nekku_score      IS NOT NULL THEN 1 ELSE 0 END) AS avg
    FROM users
    WHERE test_score IS NOT NULL OR ouri_score IS NOT NULL OR math_score IS NOT NULL
       OR kakougaku_score IS NOT NULL OR nekku_score IS NOT NULL
    ORDER BY avg ASC
    LIMIT 3
  `);
  if (!rows[0]) return res.status(400).json({ error: '点数入力済みのユーザーがいません' });
  const frames = ['baka', 'moeru', 'kusai'];
  const assigned = [];
  for (let i = 0; i < rows.length; i++) {
    await pool.query('UPDATE users SET frame=$1 WHERE id=$2', [frames[i], rows[i].id]);
    assigned.push({ username: rows[i].username, frame: frames[i], avg: Math.round(rows[i].avg * 10) / 10 });
  }
  res.json({ ok: true, assigned });
});

// プール配分：1/誤差² の比率でポイントを配分
app.post('/api/admin/distribute-pool', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  // 予測・得点・賭け金が揃ったユーザーのみ
  const { rows: participants } = await pool.query(
    'SELECT id, username, test_pred, test_score, test_bet FROM users WHERE test_pred IS NOT NULL AND test_score IS NOT NULL AND test_bet IS NOT NULL'
  );
  if (!participants.length) return res.status(400).json({ error: '対象者がいません' });

  const { rows: poolRow } = await pool.query('SELECT COALESCE(SUM(test_bet),0) AS total FROM users WHERE test_bet IS NOT NULL');
  const totalPool = Number(poolRow[0].total);

  // 誤差0（完全的中）の人を探す
  const perfect = participants.filter(p => Math.abs(p.test_pred - p.test_score) === 0);

  let payouts; // [{id, username, amount}]

  if (perfect.length > 0) {
    // 完全的中組で均等分配、あまりは最初の人へ
    const share = Math.floor(totalPool / perfect.length);
    const remainder = totalPool - share * perfect.length;
    payouts = perfect.map((p, i) => ({ id: p.id, username: p.username, amount: share + (i === 0 ? remainder : 0) }));
  } else {
    // weight_i = 1 / err²、浮動小数で計算
    const withWeight = participants.map(p => {
      const err = Math.abs(p.test_pred - p.test_score);
      return { ...p, weight: 1 / (err * err) };
    });
    const weightSum = withWeight.reduce((s, p) => s + p.weight, 0);
    // floor 配分
    const floored = withWeight.map(p => ({ ...p, share: Math.floor(totalPool * p.weight / weightSum) }));
    const distributed = floored.reduce((s, p) => s + p.share, 0);
    const remainder = totalPool - distributed;
    // あまりは weight が最大の人へ
    const maxIdx = floored.reduce((mi, p, i, a) => p.weight > a[mi].weight ? i : mi, 0);
    floored[maxIdx].share += remainder;
    payouts = floored.map(p => ({ id: p.id, username: p.username, amount: p.share }));
  }

  // ポイントを付与
  for (const p of payouts) {
    await pool.query('UPDATE users SET points=points+$1 WHERE id=$2', [p.amount, p.id]);
  }
  // 賭け金をリセット（配分後は test_bet を表示ポイントに二重計上しない）
  await pool.query('UPDATE users SET test_bet=NULL WHERE test_bet IS NOT NULL');
  res.json({ ok: true, totalPool, payouts });
});

// アンケート回答済み確認
app.get('/api/survey/me', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT id FROM survey_responses WHERE user_id=$1', [req.user.id]);
  res.json({ submitted: rows.length > 0 });
});

// アンケート送信
app.post('/api/survey', auth, async (req, res) => {
  const { answers } = req.body;
  if (!answers || typeof answers !== 'object') return res.status(400).json({ error: '回答データが不正です' });
  try {
    const { rows: ex } = await pool.query('SELECT id FROM survey_responses WHERE user_id=$1', [req.user.id]);
    if (ex.length > 0) return res.status(409).json({ error: '回答済みです' });
    await pool.query(
      'INSERT INTO survey_responses (user_id, answers) VALUES ($1, $2)',
      [req.user.id, JSON.stringify(answers)]
    );
    // 😼をインベントリに追加してアバターにも設定
    const { rows: ua } = await pool.query('SELECT unlocked_avatars FROM users WHERE id=$1', [req.user.id]);
    const inv = JSON.parse(ua[0]?.unlocked_avatars || '[]');
    if (!inv.includes('😼')) inv.push('😼');
    await pool.query("UPDATE users SET avatar='😼', unlocked_avatars=$1 WHERE id=$2", [JSON.stringify(inv), req.user.id]);
    const { rows } = await pool.query('SELECT points, test_bet, avatar, unlocked_avatars FROM users WHERE id=$1', [req.user.id]);
    res.json({ ok: true, avatar: rows[0].avatar, unlockedAvatars: JSON.parse(rows[0].unlocked_avatars || '[]') });
  } catch(e) {
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// 管理者：アンケート結果一覧
app.get('/api/admin/survey', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  const { rows } = await pool.query(`
    SELECT u.username, u.test_score, s.answers, s.created_at
    FROM survey_responses s JOIN users u ON u.id = s.user_id
    ORDER BY s.created_at ASC
  `);
  res.json(rows);
});

// 特定ユーザーの得点をリセット（管理者のみ）
app.post('/api/admin/reset-test-score', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'ユーザー名が必要です' });
  const { rows } = await pool.query('UPDATE users SET test_score=NULL WHERE username=$1 RETURNING id, username', [username]);
  if (!rows[0]) return res.status(404).json({ error: 'ユーザーが見つかりません' });
  res.json({ ok: true, username: rows[0].username });
});

// クイズ進捗を取得
app.get('/api/progress/:quizKey', auth, async (req, res) => {
  const { quizKey } = req.params;
  const { rows } = await pool.query(
    'SELECT state_json FROM quiz_progress WHERE user_id=$1 AND quiz_key=$2',
    [req.user.id, quizKey]
  );
  res.json({ state: rows[0] ? JSON.parse(rows[0].state_json) : {} });
});

// クイズ進捗を保存
app.put('/api/progress/:quizKey', auth, async (req, res) => {
  const { quizKey } = req.params;
  const { state } = req.body;
  if (!state || typeof state !== 'object') return res.status(400).json({ error: '不正なデータ' });
  await pool.query(
    `INSERT INTO quiz_progress (user_id, quiz_key, state_json, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, quiz_key) DO UPDATE SET state_json=$3, updated_at=NOW()`,
    [req.user.id, quizKey, JSON.stringify(state)]
  );
  res.json({ ok: true });
});

// 管理者：ポイント付与
app.post('/api/admin/grant-points', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  const { userId, amount } = req.body;
  if (!userId || !Number.isInteger(amount)) return res.status(400).json({ error: '不正なリクエスト（整数のptを指定）' });
  await pool.query('UPDATE users SET points = points + $1, season_points = season_points + $1 WHERE id = $2', [amount, userId]);
  const { rows } = await pool.query('SELECT points, test_bet, season_points FROM users WHERE id = $1', [userId]);
  res.json({ ok: true, points: dsp(rows[0]), lifetime_points: dp(rows[0]) });
});

// 管理者：個人ポイント直接設定
app.post('/api/admin/set-points-user', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  const { userId, points } = req.body;
  if (!userId || !Number.isInteger(points) || points < 0) return res.status(400).json({ error: '不正なリクエスト' });
  const { rows } = await pool.query('SELECT test_bet FROM users WHERE id = $1', [userId]);
  if (!rows[0]) return res.status(404).json({ error: 'ユーザーが見つかりません' });
  const newPoints = Math.max(0, points - (rows[0].test_bet || 0));
  await pool.query('UPDATE users SET points = $1 WHERE id = $2', [newPoints, userId]);
  const { rows: r } = await pool.query('SELECT points, test_bet, season_points FROM users WHERE id = $1', [userId]);
  res.json({ ok: true, points: dsp(r[0]), lifetime_points: dp(r[0]) });
});

// 管理者：シーズンポイントリセット
app.post('/api/admin/reset-season-points', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  await pool.query('UPDATE users SET season_points = 0');
  res.json({ ok: true });
});

// 管理者：season_points → points に同期（累計が0になった場合の修復）
app.post('/api/admin/restore-season-points', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  await pool.query('UPDATE users SET points = season_points');
  const { rows } = await pool.query('SELECT username, points, season_points FROM users ORDER BY season_points DESC');
  res.json({ ok: true, users: rows });
});

// 管理者：称号設定
app.post('/api/admin/set-title', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  const { username, title, title_class } = req.body;
  if (!username) return res.status(400).json({ error: 'usernameが必要' });
  const { rowCount } = await pool.query(
    'UPDATE users SET title=$1, title_class=$2 WHERE username=$3',
    [title || null, title_class || null, username]
  );
  res.json({ ok: true, updated: rowCount });
});

// 管理者：ポイント確認（デバッグ用）
app.get('/api/admin/debug-points', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  const { rows } = await pool.query('SELECT username, points, season_points, test_bet FROM users ORDER BY username');
  res.json(rows);
});

// 管理者：ポイント一括設定（リセット前の値を復元）
app.post('/api/admin/restore-points-manual', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  const DATA = {
    '福澤': 61700,
    'professional-A': 27760,
    'はせがわ': 25140,
    'やー': 21100,
    'MCsho': 13600,
    'MCSho': 13600,
    'ちんこうや': 17700,
    'SHIMESABA': 15800,
    'Shochan': 8000,
    'ミッツ': 7800,
    '波多野裏技': 5100,
    'honari': 5000,
    'seijuro_dummy': 4000,
  };
  // DB の全ユーザー名を取得してデバッグ情報として返す
  const { rows: allUsers } = await pool.query('SELECT id, username FROM users');
  const results = [];
  for (const [username, pts] of Object.entries(DATA)) {
    const { rowCount } = await pool.query(
      'UPDATE users SET points = GREATEST(0, $1 - COALESCE(test_bet, 0)), season_points = 0 WHERE LOWER(username) = LOWER($2)',
      [pts, username]
    );
    results.push(`${username}: ${pts}pt → ${rowCount > 0 ? '✅' : '❌ 未マッチ'}`);
  }
  const dbNames = allUsers.map(u => u.username);
  res.json({ ok: true, results, dbUsers: dbNames });
});

// 管理者：全プレイヤー一斉ポイント配布
app.post('/api/admin/grant-all', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  const { amount } = req.body;
  if (!Number.isInteger(amount) || amount <= 0 || amount > 10000) return res.status(400).json({ error: '不正なポイント数（1〜10000）' });
  const { rows } = await pool.query('UPDATE users SET points = points + $1, season_points = season_points + $1 RETURNING id, username', [amount]);
  res.json({ ok: true, count: rows.length, amount });
  syncWorstFrame();
});

// サイトステータス（公開）
app.get('/api/site-status', async (req, res) => {
  res.json({ locked: siteLocked, registrationLocked });
});

// 得点入力ステータス（公開）
app.get('/api/score-status', async (req, res) => {
  res.json({ locked: scoreInputLocked });
});

// 管理者：得点入力締め切り
app.post('/api/admin/lock-score', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  scoreInputLocked = true;
  await pool.query("INSERT INTO settings (key, value) VALUES ('score_locked','true') ON CONFLICT (key) DO UPDATE SET value='true'");
  res.json({ ok: true });
});

// 管理者：得点入力締め切り解除
app.post('/api/admin/unlock-score', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  scoreInputLocked = false;
  await pool.query("INSERT INTO settings (key, value) VALUES ('score_locked','false') ON CONFLICT (key) DO UPDATE SET value='false'");
  res.json({ ok: true });
});

// 管理者：新規登録制限
app.post('/api/admin/lock-registration', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  registrationLocked = true;
  await pool.query("INSERT INTO settings (key, value) VALUES ('registration_locked','true') ON CONFLICT (key) DO UPDATE SET value='true'");
  res.json({ ok: true });
});

app.post('/api/admin/unlock-registration', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  registrationLocked = false;
  await pool.query("INSERT INTO settings (key, value) VALUES ('registration_locked','false') ON CONFLICT (key) DO UPDATE SET value='false'");
  res.json({ ok: true });
});

// 管理者：サイトロック
app.post('/api/admin/lock', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  siteLocked = true;
  await pool.query("INSERT INTO settings (key, value) VALUES ('site_locked','true') ON CONFLICT (key) DO UPDATE SET value='true'");
  res.json({ ok: true });
});

// 管理者：サイトロック解除
app.post('/api/admin/unlock', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  siteLocked = false;
  await pool.query("INSERT INTO settings (key, value) VALUES ('site_locked','false') ON CONFLICT (key) DO UPDATE SET value='false'");
  res.json({ ok: true });
});

// ── 試験日程 ──────────────────────────────────────────────────
app.get('/api/exam-schedule', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM exam_schedule');
  res.json(rows);
});

app.post('/api/admin/exam-schedule', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  const { subject, exam, archive_after } = req.body;
  if (!subject || !exam) return res.status(400).json({ error: 'subject, examが必要' });
  await pool.query(
    `INSERT INTO exam_schedule (subject, exam, archive_after)
     VALUES ($1, $2, $3)
     ON CONFLICT (subject, exam) DO UPDATE SET archive_after = $3`,
    [subject, exam, archive_after || null]
  );
  res.json({ ok: true });
});

// ── バナー ────────────────────────────────────────────────────
app.get('/api/banners', async (req, res) => {
  const { rows } = await pool.query('SELECT id, date, title, body, is_new, author, user_id, created_at FROM banners ORDER BY date DESC, id DESC');
  res.json(rows);
});

// メンバー投稿（ログイン必須）
app.post('/api/banners', auth, async (req, res) => {
  const { title, body } = req.body;
  if (!title) return res.status(400).json({ error: 'titleが必要' });
  const now = new Date().toISOString();
  const { rows } = await pool.query(
    'INSERT INTO banners (date, title, body, is_new, created_at, user_id, author) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [now.slice(0,10), title, body, true, now, req.user.id, req.user.username]
  );
  res.json({ ok: true, id: rows[0].id });
});

// 削除（自分の投稿 or 管理者）
app.delete('/api/banners/:id', auth, async (req, res) => {
  const id = parseInt(req.params.id);
  const { rows } = await pool.query('SELECT user_id FROM banners WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).json({ error: '見つかりません' });
  const isAdmin = req.user.email === 'kabu6113450@gmail.com';
  if (!isAdmin && rows[0].user_id !== req.user.id) return res.status(403).json({ error: '権限がありません' });
  await pool.query('DELETE FROM banners WHERE id = $1', [id]);
  res.json({ ok: true });
});

// 管理者用（日付・is_new を細かく指定したいとき用）
app.post('/api/admin/banners', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  const { date, title, body, is_new } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'titleとbodyが必要' });
  const now = new Date().toISOString();
  const { rows } = await pool.query(
    'INSERT INTO banners (date, title, body, is_new, created_at, author, user_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [date || now.slice(0,10), title, body, is_new !== false, now, req.user.username, req.user.id]
  );
  res.json({ ok: true, id: rows[0].id });
});

// ── バトルイベント ────────────────────────────────────────────
const BATTLE_SUBJ_COL = { eigo: 'test_score', ouri: 'ouri_score', math: 'math_score', kakougaku: 'kakougaku_score', nekku: 'nekku_score', seigyo: 'seigyo_score' };

// バトル一覧（公開）
app.get('/api/battles', async (req, res) => {
  // オプション認証：自分のベット情報を返す
  let myId = null;
  const token = req.headers['authorization'];
  if (token) {
    try {
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user) { const { rows } = await pool.query('SELECT id FROM users WHERE supabase_id=$1', [user.id]); myId = rows[0]?.id; }
    } catch(e) {}
    if (!myId) { const { rows } = await pool.query('SELECT id FROM users WHERE session_token=$1', [token]); myId = rows[0]?.id; }
  }
  const { rows } = await pool.query(`
    SELECT b.id, b.subject, b.status, b.p1_bet, b.p2_bet, b.created_at,
      u1.username AS p1_name, u1.avatar AS p1_avatar,
      u2.username AS p2_name, u2.avatar AS p2_avatar,
      uw.username AS winner_name,
      bb.side AS my_side, bb.amount AS my_bet
    FROM battles b
    JOIN users u1 ON b.p1_id = u1.id
    JOIN users u2 ON b.p2_id = u2.id
    LEFT JOIN users uw ON b.winner_id = uw.id
    LEFT JOIN battle_bets bb ON bb.battle_id = b.id AND bb.user_id = $1
    ORDER BY b.created_at DESC, b.id
  `, [myId || 0]);
  res.json(rows);
});

// ベット設定（全員参加可能）
app.post('/api/battles/:id/bet', auth, async (req, res) => {
  const battleId = parseInt(req.params.id);
  const { amount, side } = req.body;
  const uid = req.user.id;
  if (!Number.isInteger(amount) || amount < 0) return res.status(400).json({ error: '0以上の整数を入力してください' });
  if (side !== 1 && side !== 2) return res.status(400).json({ error: 'sideは1か2を指定してください' });
  const { rows } = await pool.query('SELECT * FROM battles WHERE id=$1', [battleId]);
  const battle = rows[0];
  if (!battle) return res.status(404).json({ error: 'バトルが見つかりません' });
  if (battle.status !== 'open') return res.status(400).json({ error: '受付終了済みです' });
  // 既存ベットを取得して差分計算
  const { rows: ex } = await pool.query('SELECT amount FROM battle_bets WHERE battle_id=$1 AND user_id=$2', [battleId, uid]);
  const oldAmount = ex[0]?.amount || 0;
  const diff = amount - oldAmount;
  if (diff > 0 && req.user.season_points < diff) return res.status(400).json({ error: 'シーズンptが足りません' });
  if (amount === 0) {
    await pool.query('DELETE FROM battle_bets WHERE battle_id=$1 AND user_id=$2', [battleId, uid]);
  } else {
    await pool.query(`
      INSERT INTO battle_bets (battle_id, user_id, side, amount, created_at)
      VALUES ($1,$2,$3,$4,$5) ON CONFLICT (battle_id, user_id) DO UPDATE SET side=$3, amount=$4
    `, [battleId, uid, side, amount, new Date().toISOString()]);
  }
  if (diff !== 0) await pool.query('UPDATE users SET season_points=season_points-$1 WHERE id=$2', [diff, uid]);
  // p1_bet/p2_bet を集計して更新
  const { rows: totals } = await pool.query(`
    SELECT COALESCE(SUM(CASE WHEN side=1 THEN amount ELSE 0 END),0) AS t1,
           COALESCE(SUM(CASE WHEN side=2 THEN amount ELSE 0 END),0) AS t2
    FROM battle_bets WHERE battle_id=$1
  `, [battleId]);
  await pool.query('UPDATE battles SET p1_bet=$1, p2_bet=$2 WHERE id=$3', [totals[0].t1, totals[0].t2, battleId]);
  const { rows: u } = await pool.query('SELECT points, test_bet, season_points FROM users WHERE id=$1', [uid]);
  res.json({ ok: true, season_points: dsp(u[0]) });
});

// バトル作成（管理者）
app.post('/api/admin/battles/create', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  const { subject, race_id } = req.body;
  if (!subject) return res.status(400).json({ error: 'subjectが必要' });
  const raceId = race_id ? parseInt(race_id) : null;
  const { rows: users } = await pool.query(
    `SELECT id, username FROM users WHERE username NOT IN ('seijuro_dummy','honari2') ORDER BY id`
  );

  // 20ペア固定: スロット方式（かぶりなし・自己対戦なし）
  // 12人×40スロット → 4人が4試合、8人が3試合
  const TARGET_PAIRS = 20;
  const totalSlots = TARGET_PAIRS * 2;
  const n = users.length;
  const base = Math.floor(totalSlots / n);
  const extra = totalSlots % n;

  function shuffled(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // スロットリスト生成（誰が多めかはシャッフルで毎回ランダム）
  function makeSlots() {
    const ord = shuffled(users);
    const s = [];
    ord.forEach((u, i) => {
      const cnt = i < extra ? base + 1 : base;
      for (let k = 0; k < cnt; k++) s.push(u);
    });
    return s;
  }

  let allPairs = null;
  for (let attempt = 0; attempt < 3000; attempt++) {
    const s = shuffled(makeSlots());
    const pairs = [];
    const seen = new Set();
    let valid = true;
    for (let i = 0; i + 1 < s.length; i += 2) {
      const a = s[i].id, b = s[i + 1].id;
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (a === b || seen.has(key)) { valid = false; break; }
      seen.add(key);
      pairs.push([s[i], s[i + 1]]);
    }
    if (valid && pairs.length === TARGET_PAIRS) { allPairs = pairs; break; }
  }
  if (!allPairs) return res.status(500).json({ error: '対戦表の生成に失敗しました（リトライ上限）' });

  await pool.query("DELETE FROM battles WHERE subject = $1 AND status = 'open'", [subject]);
  const now = new Date().toISOString();
  for (const [p1, p2] of allPairs) {
    await pool.query('INSERT INTO battles (subject, p1_id, p2_id, race_id, created_at) VALUES ($1, $2, $3, $4, $5)',
      [subject, p1.id, p2.id, raceId, now]);
  }
  res.json({ ok: true, pairs: allPairs.map(([a, b]) => [a.username, b.username]) });
});

// バトル決着（管理者）— 全員参加型オッズ配分
app.post('/api/admin/battles/settle', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  const { subject } = req.body;
  const scoreCol = BATTLE_SUBJ_COL[subject];
  if (!scoreCol) return res.status(400).json({ error: '無効な教科: ' + subject });
  const { rows: battles } = await pool.query("SELECT * FROM battles WHERE subject=$1 AND status='open'", [subject]);
  const results = [];
  for (const b of battles) {
    const { rows: r1 } = await pool.query(`SELECT ${scoreCol} AS score, username FROM users WHERE id=$1`, [b.p1_id]);
    const { rows: r2 } = await pool.query(`SELECT ${scoreCol} AS score, username FROM users WHERE id=$1`, [b.p2_id]);
    const s1 = r1[0]?.score, s2 = r2[0]?.score;
    if (s1 == null || s2 == null) {
      results.push({ result: `${r1[0]?.username} vs ${r2[0]?.username}: スコア未入力 — スキップ` });
      continue;
    }
    const { rows: bets } = await pool.query('SELECT * FROM battle_bets WHERE battle_id=$1', [b.id]);
    const totalPool = bets.reduce((s, bet) => s + bet.amount, 0);
    if (s1 === s2) {
      // 引き分け：全員に返還
      for (const bet of bets) {
        await pool.query('UPDATE users SET season_points=season_points+$1 WHERE id=$2', [bet.amount, bet.user_id]);
      }
      await pool.query("UPDATE battles SET status='settled' WHERE id=$1", [b.id]);
      results.push({ result: `${r1[0].username} vs ${r2[0].username}: 引き分け (${s1}点) → 全員返還` });
    } else {
      const winningSide = s1 > s2 ? 1 : 2;
      const winnerId = winningSide === 1 ? b.p1_id : b.p2_id;
      const wName = winningSide === 1 ? r1[0].username : r2[0].username;
      const lName = winningSide === 1 ? r2[0].username : r1[0].username;
      const wScore = winningSide === 1 ? s1 : s2;
      const lScore = winningSide === 1 ? s2 : s1;
      const winBets = bets.filter(b => b.side === winningSide);
      const winTotal = winBets.reduce((s, b) => s + b.amount, 0);
      if (totalPool > 0 && winTotal > 0) {
        // 勝った側でプールを比率配分
        let distributed = 0;
        for (const bet of winBets) {
          const payout = Math.floor((bet.amount / winTotal) * totalPool);
          await pool.query('UPDATE users SET season_points=season_points+$1 WHERE id=$2', [payout, bet.user_id]);
          distributed += payout;
        }
        // 端数は最大ベット者に追加
        const remainder = totalPool - distributed;
        if (remainder > 0) {
          const top = winBets.sort((a, b) => b.amount - a.amount)[0];
          await pool.query('UPDATE users SET season_points=season_points+$1 WHERE id=$2', [remainder, top.user_id]);
        }
      } else if (winTotal === 0 && totalPool > 0) {
        // 勝った側に誰も賭けていない → 全員返還
        for (const bet of bets) {
          await pool.query('UPDATE users SET season_points=season_points+$1 WHERE id=$2', [bet.amount, bet.user_id]);
        }
      }
      const odds = winTotal > 0 ? (totalPool / winTotal).toFixed(2) : '∞';
      await pool.query("UPDATE battles SET status='settled', winner_id=$1 WHERE id=$2", [winnerId, b.id]);
      results.push({ result: `${wName}(${wScore}点) > ${lName}(${lScore}点) → ${wName}派に ${odds}倍 配分 (計${totalPool}pt)` });
    }
  }
  res.json({ ok: true, results });
});

// ── レース ──────────────────────────────────────────────────────
// レース一覧（管理者向け）
app.get('/api/races', async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, name, subject, active, status, start_date, end_date FROM races ORDER BY id DESC LIMIT 20");
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// 現在のアクティブレース取得（誰でも）
app.get('/api/races/current', async (req, res) => {
  try {
    const { rows: races } = await pool.query("SELECT * FROM races WHERE active=1 ORDER BY id DESC LIMIT 1");
    if (!races[0]) return res.json({ race: null, groups: [], study_logs: [], bets: [] });
    const race = races[0];
    const { rows: groups } = await pool.query("SELECT * FROM race_groups WHERE race_id=$1 ORDER BY id", [race.id]);
    const groupIds = groups.map(g => g.id);
    let members = [];
    if (groupIds.length) {
      const { rows } = await pool.query(
        `SELECT rgm.group_id, u.id AS user_id, u.username, u.avatar, u.frame, u.season_points
         FROM race_group_members rgm
         JOIN users u ON u.id = rgm.user_id
         WHERE rgm.group_id = ANY($1) AND u.username != 'seijuro_dummy'`,
        [groupIds]
      );
      members = rows;
    }
    const { rows: logs } = await pool.query(
      "SELECT rsl.* FROM race_study_log rsl JOIN users u ON u.id=rsl.user_id WHERE rsl.race_id=$1 AND u.username!='seijuro_dummy'",
      [race.id]
    );
    const { rows: bets } = await pool.query("SELECT * FROM race_bets WHERE race_id=$1", [race.id]);
    // グローバルペアデータ取得
    const { rows: pairs } = await pool.query("SELECT * FROM race_pairs WHERE race_id IS NULL ORDER BY id");
    let pairMembers = [];
    if (pairs.length) {
      const { rows: pm } = await pool.query(
        `SELECT rpm.pair_id, u.id AS user_id, u.username, u.season_points
         FROM race_pair_members rpm
         JOIN users u ON u.id = rpm.user_id
         WHERE rpm.pair_id = ANY($1) AND u.username != 'seijuro_dummy'`,
        [pairs.map(p => p.id)]
      );
      pairMembers = pm;
    }
    const groupsWithMembers = groups.map(g => ({ ...g, members: members.filter(m => m.group_id === g.id) }));
    const pairsWithMembers = pairs.map(p => ({ ...p, members: pairMembers.filter(m => m.pair_id === p.id) }));
    res.json({ race, groups: groupsWithMembers, study_logs: logs, bets, pairs: pairsWithMembers });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// レース発行（管理者）— 既存アクティブレースを停止してシーズンptリセット→新規作成
app.post('/api/admin/races', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  const { name, start_date, end_date, subject, groups } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    await pool.query("UPDATE races SET active=0 WHERE active=1");
    // 新レース＝新シーズン：シーズンptとログインボーナスと解答履歴をリセット
    await pool.query("UPDATE users SET season_points=0, last_login=''");
    if (subject) await pool.query("DELETE FROM quiz_answers WHERE subject=$1", [subject]);
    const { rows } = await pool.query(
      "INSERT INTO races(name, start_date, end_date, subject, active, status, created_at) VALUES($1,$2,$3,$4,1,'active',$5) RETURNING id",
      [name, start_date || '', end_date || '', subject || '', new Date().toISOString()]
    );
    const raceId = rows[0].id;
    if (Array.isArray(groups)) {
      for (const g of groups) {
        const { rows: gr } = await pool.query(
          "INSERT INTO race_groups(race_id, name) VALUES($1,$2) RETURNING id",
          [raceId, g.name || 'グループ']
        );
        const gid = gr[0].id;
        for (const uid of (g.members || [])) {
          await pool.query(
            "INSERT INTO race_group_members(group_id, user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
            [gid, parseInt(uid)]
          ).catch(() => {});
        }
      }
    }
    res.json({ ok: true, race_id: raceId });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// 勉強時間ログ更新（ログイン必須）— 各項目は入力値を既存値に加算
app.put('/api/races/:id/study', auth, async (req, res) => {
  const raceId = parseInt(req.params.id);
  const userId = req.user.id;
  const { muto_minutes, muto_tool, manual_minutes, manual_tool, game_minutes } = req.body;
  const mm  = parseInt(muto_minutes)   || 0;
  const man = parseInt(manual_minutes) || 0;
  const gm  = parseInt(game_minutes)   || 0;
  try {
    // statusがactiveでなければ拒否
    const { rows: raceCheck } = await pool.query("SELECT status FROM races WHERE id=$1", [raceId]);
    if (!raceCheck[0]) return res.status(404).json({ error: 'レースが見つかりません' });
    if (raceCheck[0].status !== 'active') return res.status(400).json({ error: 'レースはすでに終了しています' });
    await pool.query(`
      INSERT INTO race_study_log(race_id, user_id, muto_minutes, muto_tool, manual_minutes, manual_tool, game_minutes, updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT(race_id, user_id) DO UPDATE SET
        muto_minutes   = GREATEST(0, race_study_log.muto_minutes   + $3),
        muto_tool      = CASE WHEN $3 <> 0 THEN $4 ELSE race_study_log.muto_tool END,
        manual_minutes = GREATEST(0, race_study_log.manual_minutes + $5),
        manual_tool    = CASE WHEN $5 <> 0 THEN $6 ELSE race_study_log.manual_tool END,
        game_minutes   = GREATEST(0, race_study_log.game_minutes   + $7),
        updated_at     = $8
    `, [raceId, userId,
        mm,  muto_tool   || '',
        man, manual_tool || '',
        gm,  new Date().toISOString()]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// グローバルペア取得
app.get('/api/pairs', async (req, res) => {
  try {
    const { rows: pairs } = await pool.query("SELECT * FROM race_pairs WHERE race_id IS NULL ORDER BY id");
    if (!pairs.length) return res.json([]);
    const { rows: members } = await pool.query(
      `SELECT rpm.pair_id, u.id AS user_id, u.username, u.season_points
       FROM race_pair_members rpm
       JOIN users u ON u.id = rpm.user_id
       WHERE rpm.pair_id = ANY($1)`,
      [pairs.map(p => p.id)]
    );
    res.json(pairs.map(p => ({ ...p, members: members.filter(m => m.pair_id === p.id) })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ペア名変更（メンバー本人のみ）
app.put('/api/pairs/:id/name', auth, async (req, res) => {
  const pairId = parseInt(req.params.id);
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: '名前が必要' });
  try {
    const { rows } = await pool.query(
      "SELECT 1 FROM race_pair_members WHERE pair_id=$1 AND user_id=$2",
      [pairId, req.user.id]
    );
    if (!rows.length) return res.status(403).json({ error: 'このペアのメンバーではありません' });
    await pool.query("UPDATE race_pairs SET name=$1 WHERE id=$2", [name.trim(), pairId]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// グローバルペア設定（管理者）— 一括登録・上書き
app.post('/api/admin/pairs', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  const { pairs } = req.body;
  if (!Array.isArray(pairs)) return res.status(400).json({ error: 'pairs配列が必要' });
  try {
    await pool.query("DELETE FROM race_pairs WHERE race_id IS NULL");
    for (const p of pairs) {
      const { rows } = await pool.query(
        "INSERT INTO race_pairs(race_id, name) VALUES(NULL,$1) RETURNING id",
        [p.name || 'ペア']
      );
      const pairId = rows[0].id;
      for (const uid of (p.members || [])) {
        await pool.query(
          "INSERT INTO race_pair_members(pair_id, user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
          [pairId, parseInt(uid)]
        ).catch(() => {});
      }
    }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// レース終了→賭けフェーズへ移行（管理者）
app.post('/api/admin/races/:id/close', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  await pool.query("UPDATE races SET status='betting' WHERE id=$1", [parseInt(req.params.id)]);
  res.json({ ok: true });
});

// 賭け投票（ログイン必須）— season_points を賭ける、1レース1票
app.post('/api/races/:id/bet', auth, async (req, res) => {
  const raceId = parseInt(req.params.id);
  const userId = req.user.id;
  const { target_user_id, amount } = req.body;
  if (!target_user_id || !Number.isInteger(amount) || amount <= 0) return res.status(400).json({ error: '無効な入力' });
  try {
    const { rows: race } = await pool.query("SELECT status FROM races WHERE id=$1 AND active=1", [raceId]);
    if (!race[0] || race[0].status !== 'betting') return res.status(400).json({ error: '賭けフェーズではありません' });
    const { rows: u } = await pool.query("SELECT season_points FROM users WHERE id=$1", [userId]);
    if (!u[0] || u[0].season_points < amount) return res.status(400).json({ error: 'シーズンptが足りません' });
    // 既存ベットがあれば差分調整
    const { rows: ex } = await pool.query("SELECT amount, target_user_id FROM race_bets WHERE race_id=$1 AND user_id=$2", [raceId, userId]);
    if (ex[0]) {
      const diff = amount - ex[0].amount;
      await pool.query("UPDATE users SET season_points=season_points-$1 WHERE id=$2", [diff, userId]);
      await pool.query("UPDATE race_bets SET target_user_id=$1, amount=$2 WHERE race_id=$3 AND user_id=$4",
        [target_user_id, amount, raceId, userId]);
    } else {
      await pool.query("UPDATE users SET season_points=season_points-$1 WHERE id=$2", [amount, userId]);
      await pool.query("INSERT INTO race_bets(race_id,user_id,target_user_id,amount) VALUES($1,$2,$3,$4)",
        [raceId, userId, target_user_id, amount]);
    }
    const { rows: r } = await pool.query("SELECT season_points FROM users WHERE id=$1", [userId]);
    res.json({ ok: true, season_points: r[0].season_points });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// 賭け決着（管理者）— 最多勉強時間のユーザーに賭けた人でプールを山分け
app.post('/api/admin/races/:id/settle', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  const raceId = parseInt(req.params.id);
  try {
    const { rows: race } = await pool.query("SELECT * FROM races WHERE id=$1", [raceId]);
    if (!race[0]) return res.status(404).json({ error: 'レースが見つかりません' });
    // 勝者判定: 合計勉強時間（muto_minutes + auto_seconds/60 + manual_minutes）が最大のユーザー
    const { rows: logs } = await pool.query(
      "SELECT user_id, (muto_minutes + auto_seconds/60 + manual_minutes) AS total FROM race_study_log WHERE race_id=$1 ORDER BY total DESC LIMIT 1",
      [raceId]
    );
    const { rows: bets } = await pool.query("SELECT * FROM race_bets WHERE race_id=$1", [raceId]);
    const totalPool = bets.reduce((s, b) => s + b.amount, 0);
    let resultMsg = '';
    if (!logs[0] || !bets.length) {
      resultMsg = '賭けなし or 勉強記録なし — 全員返還';
      for (const b of bets) await pool.query("UPDATE users SET season_points=season_points+$1 WHERE id=$2", [b.amount, b.user_id]);
    } else {
      const winnerId = logs[0].user_id;
      const winBets = bets.filter(b => b.target_user_id === winnerId);
      const winTotal = winBets.reduce((s, b) => s + b.amount, 0);
      if (!winTotal) {
        resultMsg = '勝者に賭けた人がいないため全員返還';
        for (const b of bets) await pool.query("UPDATE users SET season_points=season_points+$1 WHERE id=$2", [b.amount, b.user_id]);
      } else {
        let dist = 0;
        for (const b of winBets) {
          const pay = Math.floor((b.amount / winTotal) * totalPool);
          await pool.query("UPDATE users SET season_points=season_points+$1 WHERE id=$2", [pay, b.user_id]);
          dist += pay;
        }
        if (totalPool - dist > 0) {
          const top = winBets.sort((a,b) => b.amount - a.amount)[0];
          await pool.query("UPDATE users SET season_points=season_points+$1 WHERE id=$2", [totalPool - dist, top.user_id]);
        }
        resultMsg = `勝者ユーザーID ${winnerId} に賭けた ${winBets.length} 人で ${totalPool}pt 分配`;
      }
    }
    await pool.query("UPDATE races SET status='closed', active=0 WHERE id=$1", [raceId]);
    res.json({ ok: true, result: resultMsg });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.use(express.static('.'));

const PORT = process.env.PORT || 3000;
initDB().then(async () => {
  // DB からロック状態を復元
  const { rows } = await pool.query("SELECT value FROM settings WHERE key='site_locked'").catch(() => ({ rows: [] }));
  siteLocked = rows[0]?.value === 'true';
  const { rows: sr } = await pool.query("SELECT value FROM settings WHERE key='score_locked'").catch(() => ({ rows: [] }));
  scoreInputLocked = sr[0]?.value === 'true';
  const { rows: rr } = await pool.query("SELECT value FROM settings WHERE key='registration_locked'").catch(() => ({ rows: [] }));
  registrationLocked = rr[0]?.value === 'true';
  app.listen(PORT, () => console.log(`サーバー起動中 → http://localhost:${PORT}`));
}).catch(err => { console.error('起動エラー:', err); process.exit(1); });
