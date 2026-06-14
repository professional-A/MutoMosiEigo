const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
const db = new Database('data.db');

app.use(express.json());
app.use(express.static('public'));

// テーブル作成（初回起動時のみ）
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    token    TEXT
  );
  CREATE TABLE IF NOT EXISTS scores (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    score      INTEGER NOT NULL,
    total      INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// 登録
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '名前とパスワードが必要です' });

  const hash = bcrypt.hashSync(password, 10);
  try {
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hash);
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: 'その名前はすでに使われています' });
  }
});

// ログイン
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '名前またはパスワードが違います' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('UPDATE users SET token = ? WHERE id = ?').run(token, user.id);
  res.json({ token, username: user.username });
});

// 認証チェック（APIに付ける鍵）
function auth(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'ログインが必要です' });
  const user = db.prepare('SELECT * FROM users WHERE token = ?').get(token);
  if (!user) return res.status(401).json({ error: 'トークンが無効です' });
  req.user = user;
  next();
}

// スコア保存
app.post('/api/score', auth, (req, res) => {
  const { score, total } = req.body;
  const existing = db.prepare('SELECT * FROM scores WHERE user_id = ?').get(req.user.id);
  const now = new Date().toISOString();
  if (existing) {
    db.prepare('UPDATE scores SET score = ?, total = ?, updated_at = ? WHERE user_id = ?')
      .run(score, total, now, req.user.id);
  } else {
    db.prepare('INSERT INTO scores (user_id, score, total, updated_at) VALUES (?, ?, ?, ?)')
      .run(req.user.id, score, total, now);
  }
  res.json({ ok: true });
});

// ランキング取得
app.get('/api/ranking', (req, res) => {
  const ranking = db.prepare(`
    SELECT u.username, s.score, s.total, s.updated_at
    FROM scores s
    JOIN users u ON s.user_id = u.id
    ORDER BY s.score DESC
  `).all();
  res.json(ranking);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`サーバー起動中 → http://localhost:${PORT}`));
