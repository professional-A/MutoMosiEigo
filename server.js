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

// Googleログイン後にユーザー情報を同期
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
  res.json({ username: u.username, avatar: u.avatar, frame: u.frame, email: u.email });
});

// アバター・フレーム更新
app.put('/api/avatar', auth, async (req, res) => {
  const { avatar, frame, username } = req.body;
  if (!avatar) return res.status(400).json({ error: 'アバターが必要です' });
  const name = username?.trim() || req.user.username;
  await pool.query('UPDATE users SET avatar = $1, frame = $2, username = $3 WHERE id = $4', [avatar, frame || 'default', name, req.user.id]);
  res.json({ ok: true });
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

// 管理者：ユーザー一覧
app.get('/api/admin/users', auth, async (req, res) => {
  if (req.user.email !== 'kabu6113450@gmail.com') return res.status(403).json({ error: '権限がありません' });
  const { rows } = await pool.query(`
    SELECT u.id, u.username, u.email, u.avatar, u.frame, u.created_at, s.score, s.total
    FROM users u LEFT JOIN scores s ON s.user_id = u.id
    ORDER BY u.id ASC
  `);
  res.json(rows);
});

app.use(express.static('.'));

const PORT = process.env.PORT || 3000;
initDB().then(() => app.listen(PORT, () => console.log(`サーバー起動中 → http://localhost:${PORT}`)));
