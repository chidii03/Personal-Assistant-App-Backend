const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@libsql/client');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Turso Database Setup
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Initialize Database Tables
async function initializeDatabase() {
  try {
    // Contacts Table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT,
        name TEXT NOT NULL,
        address TEXT,
        phone_number TEXT,
        email TEXT
      )
    `);

    // Appointments Table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        date TEXT NOT NULL,
        startTime TEXT NOT NULL,
        endTime TEXT,
        location TEXT NOT NULL
      )
    `);

    // Reminders Table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        text TEXT NOT NULL,
        date TEXT NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // History Table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        command TEXT NOT NULL,
        response TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Turso database connected');
    console.log('✅ Tables initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    process.exit(1);
  }
}

// Initialize DB
initializeDatabase();

// Routes
const contactsRouter = require('./routes/contacts')(db);
const appointmentsRouter = require('./routes/appointments')(db);
const aiRouter = require('./routes/ai');
const subscribeRouter = require('./routes/subscribe');

app.use('/api/contacts', contactsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/subscribe', subscribeRouter);

// API Key Validation Middleware
app.use((req, res, next) => {
  const requiredEnv = [
    'GEMINI_API_KEY',
    'OPENAI_API_KEY',
    'WOLFRAM_ALPHA_APPID',
  ];

  const missing = requiredEnv.filter(
    (key) => !process.env[key]
  );

  if (missing.length > 0) {
    console.warn(
      `⚠️ Missing environment variables: ${missing.join(', ')}`
    );
  }

  next();
});

// Root Route
app.get('/', (req, res) => {
  res.send('🚀 Chappie Backend running with Turso Database');
});

// Graceful Shutdown
process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

async function shutDown() {
  console.log('🛑 Shutting down server gracefully...');
  process.exit(0);
}

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});