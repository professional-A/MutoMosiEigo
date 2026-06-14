const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());

// テーブル作成＆マイグレーション
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id       SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      token    TEXT,
      avatar   TEXT DEFAULT '🐸',
      frame    TEXT DEFAULT 'default'
    );
    CREATE TABLE IF NOT EXISTS scores (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      score      INTEGER NOT NULL,
      total      INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  // 既存テーブルへの列追加（なければ追加）
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT '🐸'`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS frame  TEXT DEFAULT 'default'`).catch(()=>{});
}

// 登録
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '名前とパスワードが必要です' });

  const hash = bcrypt.hashSync(password, 10);
  try {
    await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hash]);
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: 'その名前はすでに使われています' });
  }
});

// ログイン
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  const user = rows[0];
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '名前またはパスワードが違います' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query('UPDATE users SET token = $1 WHERE id = $2', [token, user.id]);
  res.json({ token, username: user.username, avatar: user.avatar || '🐸', frame: user.frame || 'default' });
});

// 認証チェック
async function auth(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'ログインが必要です' });
  const { rows } = await pool.query('SELECT * FROM users WHERE token = $1', [token]);
  if (!rows[0]) return res.status(401).json({ error: 'トークンが無効です' });
  req.user = rows[0];
  next();
}

// アバター・フレーム更新
app.put('/api/avatar', auth, async (req, res) => {
  const { avatar, frame } = req.body;
  if (!avatar) return res.status(400).json({ error: 'アバターが必要です' });
  await pool.query('UPDATE users SET avatar = $1, frame = $2 WHERE id = $3',
    [avatar, frame || 'default', req.user.id]);
  res.json({ ok: true });
});

// スコア保存
app.post('/api/score', auth, async (req, res) => {
  const { score, total } = req.body;
  const { rows } = await pool.query('SELECT * FROM scores WHERE user_id = $1', [req.user.id]);
  const now = new Date().toISOString();
  if (rows[0]) {
    await pool.query('UPDATE scores SET score = $1, total = $2, updated_at = $3 WHERE user_id = $4',
      [score, total, now, req.user.id]);
  } else {
    await pool.query('INSERT INTO scores (user_id, score, total, updated_at) VALUES ($1, $2, $3, $4)',
      [req.user.id, score, total, now]);
  }
  res.json({ ok: true });
});

// ランキング取得
app.get('/api/ranking', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT u.username, u.avatar, u.frame, s.score, s.total, s.updated_at
    FROM scores s
    JOIN users u ON s.user_id = u.id
    ORDER BY s.score DESC
  `);
  res.json(rows);
});

// 静的ファイルはAPIルートの後に配置
app.use(express.static('.'));

const PORT = process.env.PORT || 3000;
initDB().then(() => {
  app.listen(PORT, () => console.log(`サーバー起動中 → http://localhost:${PORT}`));
});
