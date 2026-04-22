import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'drug-food-interaction-secret-key';
const PORT = 3000;

// Initialize Database
const db = new Database('app.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    drug_name TEXT NOT NULL,
    food_name TEXT NOT NULL,
    age INTEGER,
    weight INTEGER,
    prediction INTEGER,
    report TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );
`);

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // AUTH MIDDLEWARE
  const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // --- AUTH ROUTES ---
  app.post('/api/auth/signup', (req, res) => {
    const { email, password } = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const stmt = db.prepare('INSERT INTO users (email, password) VALUES (?, ?)');
      const result = stmt.run(email, hashedPassword);
      const token = jwt.sign({ id: result.lastInsertRowid, email }, JWT_SECRET);
      res.json({ token, user: { id: result.lastInsertRowid, email } });
    } catch (e) {
      if (e.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ error: 'User already exists' });
      } else {
        res.status(500).json({ error: 'Failed to create user' });
      }
    }
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (user && bcrypt.compareSync(password, user.password)) {
      const token = jwt.sign({ id: user.id, email }, JWT_SECRET);
      res.json({ token, user: { id: user.id, email } });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json({ user: req.user });
  });

  // --- PREDICTION PROXY ---
  app.post('/api/predict', authenticateToken, async (req, res) => {
    const { drug_name, food_name, age, weight } = req.body;
    try {
      const response = await fetch('http://localhost:8000/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drug_name, food_name, age, weight })
      });
      const mlResult = await response.json();
      res.json(mlResult);
    } catch (error) {
      console.error('Prediction error:', error);
      res.status(500).json({ error: 'Prediction failed' });
    }
  });

  // --- HISTORY ROUTES ---
  app.get('/api/history', authenticateToken, (req, res) => {
    const history = db.prepare('SELECT * FROM history WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    res.json(history);
  });

  app.post('/api/history', authenticateToken, (req, res) => {
    const { drug_name, food_name, age, weight, prediction, report } = req.body;
    const stmt = db.prepare(`
      INSERT INTO history (user_id, drug_name, food_name, age, weight, prediction, report)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(req.user.id, drug_name, food_name, age, weight, prediction, report);
    res.json({ success: true });
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
