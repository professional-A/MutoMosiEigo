const express = require('express');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

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
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS points     INTEGER DEFAULT 0`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TEXT DEFAULT ''`).catch(()=>{});
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
}

// 認証ミドルウェア
async function auth(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'ログインが必要です' });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'トークンが無効です' });
  const { rows } = await pool.query('SELECT * FROM users WHERE supabase_id = $1', [user.id]);
  if (!rows[0]) return res.status(401).json({ error: 'ユーザーが見つかりません' });
  req.user = rows[0];
  next();
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
  const today = new Date().toISOString().slice(0, 10);
  let loginBonus = 0;
  if (u.last_login !== today) {
    await pool.query('UPDATE users SET points = points + 1000, last_login = $1 WHERE id = $2', [today, u.id]);
    loginBonus = 1000;
  }

  const { rows: r2 } = await pool.query('SELECT * FROM users WHERE id = $1', [u.id]);
  const u2 = r2[0];
  res.json({ username: u2.username, avatar: u2.avatar, frame: u2.frame, email: u2.email, points: u2.points, loginBonus });
});

// アバター・フレーム更新
app.put('/api/avatar', auth, async (req, res) => {
  const { avatar, frame, username } = req.body;
  if (!avatar) return res.status(400).json({ error: 'アバターが必要です' });
  const name = username?.trim() || req.user.username;
  await pool.query('UPDATE users SET avatar = $1, frame = $2, username = $3 WHERE id = $4', [avatar, frame || 'default', name, req.user.id]);
  res.json({ ok: true });
});

// ポイント加算（問題正解）
app.post('/api/points', auth, async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: '不正なポイント' });
  await pool.query('UPDATE users SET points = points + $1 WHERE id = $2', [amount, req.user.id]);
  const { rows } = await pool.query('SELECT points FROM users WHERE id = $1', [req.user.id]);
  res.json({ ok: true, points: rows[0].points });
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

// ランキング
app.get('/api/ranking', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT u.username, u.avatar, u.frame, s.score, s.total, s.updated_at
    FROM scores s JOIN users u ON s.user_id = u.id
    ORDER BY s.score DESC
  `);
  res.json(rows);
});

// メンバー一覧（ポイント順、ログイン不要）
app.get('/api/members', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT username, avatar, frame, points, last_login
    FROM users
    ORDER BY points DESC
  `);
  res.json(rows);
});

// 管理者：ユーザー一覧
app.get('/api/admin/users', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  const { rows } = await pool.query(`
    SELECT u.id, u.username, u.email, u.avatar, u.frame, u.created_at, u.points, s.score, s.total
    FROM users u LEFT JOIN scores s ON s.user_id = u.id
    ORDER BY u.points DESC
  `);
  res.json(rows);
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
  if (!userId || amount === undefined || amount === null) return res.status(400).json({ error: '不正なリクエスト' });
  await pool.query('UPDATE users SET points = points + $1 WHERE id = $2', [amount, userId]);
  const { rows } = await pool.query('SELECT points FROM users WHERE id = $1', [userId]);
  res.json({ ok: true, points: rows[0].points });
});

app.use(express.static('.'));

const PORT = process.env.PORT || 3000;
initDB().then(() => app.listen(PORT, () => console.log(`サーバー起動中 → http://localhost:${PORT}`)));
