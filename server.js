const express = require('express');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function genSalt()  { return crypto.randomBytes(16).toString('hex'); }
function genToken() { return crypto.randomBytes(32).toString('hex'); }
function hashPw(pw, salt) { return crypto.pbkdf2Sync(pw, salt, 100000, 64, 'sha512').toString('hex'); }
// JST 5:00 AM でリセット（UTC+4h オフセットで計算）
function bonusDay() { return new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10); }
function dp(u) { return (u.points || 0) + (u.test_bet || 0); } // 表示ポイント（賭け中含む）

let siteLocked = false; // 管理者によるアクセス制限フラグ
let scoreInputLocked = false; // 得点入力締め切りフラグ

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
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
  `);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_id TEXT`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email       TEXT`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar      TEXT DEFAULT '🐸'`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS frame       TEXT DEFAULT 'default'`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at  TEXT DEFAULT ''`).catch(()=>{});
  await pool.query(`ALTER TABLE users ALTER COLUMN password DROP NOT NULL`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS points        INTEGER DEFAULT 0`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login   TEXT DEFAULT ''`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_salt TEXT`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS session_token TEXT`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS test_pred  INTEGER`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS test_score INTEGER`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS test_bet   INTEGER`).catch(()=>{});
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
      awarded_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, answer_key)
    )
  `).catch(()=>{});
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
  // 福澤まさみ以外のワーストフレームをリセット（一回限り）
  await pool.query(`UPDATE users SET frame='default' WHERE frame='worst' AND username != '福澤まさみ'`).catch(()=>{});
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
    await pool.query('UPDATE users SET points = points + 1000, last_login = $1 WHERE id = $2', [today, u.id]);
    loginBonus = 1000;
  }

  const { rows: r2 } = await pool.query('SELECT * FROM users WHERE id = $1', [u.id]);
  const u2 = r2[0];
  res.json({ username: u2.username, avatar: u2.avatar, frame: u2.frame, email: u2.email, points: dp(u2), loginBonus });
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
  const { amount, quizKey, questionKey, correct } = req.body;

  // quizKey/questionKey なし: シンプル加算（レガシー）
  if (!quizKey || !questionKey) {
    if (!Number.isInteger(amount) || amount <= 0 || amount > 200) return res.status(400).json({ error: '不正なポイント' });
    await pool.query('UPDATE users SET points = points + $1 WHERE id = $2', [amount, req.user.id]);
    const { rows } = await pool.query('SELECT points, test_bet FROM users WHERE id = $1', [req.user.id]);
    return res.json({ ok: true, points: dp(rows[0]), delta: amount });
  }

  // dedup モード: 初回正解+100 / 復習正解+20 / 復習不正解-50 / 初回不正解=0
  const answerKey = `${quizKey}:${questionKey}`;
  const { rows: ex } = await pool.query(
    'SELECT 1 FROM quiz_answers WHERE user_id=$1 AND answer_key=$2', [req.user.id, answerKey]
  );
  const isRepeat = ex.length > 0;

  let delta = 0;
  if (!isRepeat) {
    if (correct !== false) {
      await pool.query('INSERT INTO quiz_answers (user_id, answer_key) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, answerKey]);
      delta = Number.isInteger(amount) && amount > 0 && amount <= 200 ? amount : 100;
    }
  } else {
    delta = correct !== false ? 20 : 0;
  }

  if (delta !== 0) {
    await pool.query('UPDATE users SET points = GREATEST(0, points + $1) WHERE id = $2', [delta, req.user.id]);
  }
  const { rows } = await pool.query('SELECT points, test_bet FROM users WHERE id = $1', [req.user.id]);
  res.json({ ok: true, points: dp(rows[0]), delta });
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
    SELECT username, avatar, frame, points + COALESCE(test_bet,0) AS points, last_login, test_pred, test_bet,
           DENSE_RANK() OVER (ORDER BY points + COALESCE(test_bet,0) DESC) AS rank
    FROM users
    ORDER BY points + COALESCE(test_bet,0) DESC
  `);
  res.json(rows);
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
  res.json({ username: req.user.username, avatar: req.user.avatar, frame: req.user.frame, email: req.user.email || '', points: dp(req.user) });
});

// パスワード登録
app.post('/api/register', async (req, res) => {
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
  res.json({ token, username: u.username, avatar: u.avatar, frame: u.frame, points: dp(u), loginBonus: 1000 });
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
    await pool.query('UPDATE users SET points=points+1000, last_login=$1 WHERE id=$2', [today, u.id]);
    loginBonus = 1000;
  }
  await pool.query('UPDATE users SET session_token=$1 WHERE id=$2', [token, u.id]);
  const { rows: r } = await pool.query('SELECT * FROM users WHERE id=$1', [u.id]);
  const u2 = r[0];
  res.json({ token, username: u2.username, avatar: u2.avatar, frame: u2.frame, points: dp(u2), loginBonus });
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


// ポイント1位にワーストフレーム付与
app.post('/api/admin/award-worst', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  const { rows } = await pool.query('SELECT id, username FROM users ORDER BY points DESC LIMIT 1');
  if (!rows[0]) return res.status(400).json({ error: 'ユーザーが見つかりません' });
  await pool.query("UPDATE users SET frame='worst' WHERE id=$1", [rows[0].id]);
  res.json({ ok: true, username: rows[0].username });
});

// テスト最下位にバカフレーム付与
app.post('/api/admin/award-baka', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  const { rows } = await pool.query('SELECT id, username FROM users WHERE test_score IS NOT NULL ORDER BY test_score ASC LIMIT 1');
  if (!rows[0]) return res.status(400).json({ error: 'まだ得点が登録されていません' });
  await pool.query("UPDATE users SET frame='baka' WHERE id=$1", [rows[0].id]);
  res.json({ ok: true, username: rows[0].username });
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
    await pool.query("UPDATE users SET avatar='😼' WHERE id=$1", [req.user.id]);
    const { rows } = await pool.query('SELECT points, test_bet, avatar FROM users WHERE id=$1', [req.user.id]);
    res.json({ ok: true, avatar: rows[0].avatar });
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
  await pool.query('UPDATE users SET points = points + $1 WHERE id = $2', [amount, userId]);
  const { rows } = await pool.query('SELECT points, test_bet FROM users WHERE id = $1', [userId]);
  res.json({ ok: true, points: dp(rows[0]) });
});

// 管理者：全プレイヤー一斉ポイント配布
app.post('/api/admin/grant-all', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  const { amount } = req.body;
  if (!Number.isInteger(amount) || amount <= 0 || amount > 10000) return res.status(400).json({ error: '不正なポイント数（1〜10000）' });
  const { rows } = await pool.query('UPDATE users SET points = points + $1 RETURNING id, username', [amount]);
  res.json({ ok: true, count: rows.length, amount });
});

// サイトステータス（公開）
app.get('/api/site-status', async (req, res) => {
  res.json({ locked: siteLocked });
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

app.use(express.static('.'));

const PORT = process.env.PORT || 3000;
initDB().then(async () => {
  // DB からロック状態を復元
  const { rows } = await pool.query("SELECT value FROM settings WHERE key='site_locked'").catch(() => ({ rows: [] }));
  siteLocked = rows[0]?.value === 'true';
  const { rows: sr } = await pool.query("SELECT value FROM settings WHERE key='score_locked'").catch(() => ({ rows: [] }));
  scoreInputLocked = sr[0]?.value === 'true';
  app.listen(PORT, () => console.log(`サーバー起動中 → http://localhost:${PORT}`));
});
