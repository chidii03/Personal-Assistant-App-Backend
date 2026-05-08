const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables from .env file

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Parse JSON request bodies
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next(); 
});

// SQLite database setup
const DB_PATH = path.join(__dirname, 'personal_assistant.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
    process.exit(1); 
  } else {
    console.log('Connected to SQLite database');
    const createTables = `
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT, -- Added userId for contacts
        name TEXT NOT NULL,
        address TEXT,
        phone_number TEXT,
        email TEXT
      );
      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL, -- Ensure userId is NOT NULL for appointments
        date TEXT NOT NULL,
        startTime TEXT NOT NULL,
        endTime TEXT,
        location TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        text TEXT NOT NULL,
        date TEXT NOT NULL,
        -- You might want to add time or specific notification flags for reminders
        -- For now, this table exists but isn't fully used by the AI assistant directly for "set a reminder"
        -- The "set a reminder" command currently integrates with appointments logic.
        -- This table can be extended for more general-purpose text-based reminders.
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP -- When the reminder was created
      );
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        command TEXT NOT NULL,
        response TEXT, -- Store AI's response too
        timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    db.exec(createTables, (err) => {
      if (err) console.error('Table creation error:', err.message);
      else console.log('Tables initialized or already exist');
    });
  }
});

// Routes
const contactsRouter = require('./routes/contacts')(db);
const appointmentsRouter = require('./routes/appointments')(db);
const aiRouter = require('./routes/ai'); // New AI router
const subscribeRouter = require('./routes/subscribe'); // Assuming this is for newsletters etc.

app.use('/api/contacts', contactsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/ai', aiRouter); // Mount the new AI router
app.use('/api/subscribe', subscribeRouter);

// API Key Validation Middleware (for backend checks)
app.use((req, res, next) => {
  const requiredEnv = ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'WOLFRAM_ALPHA_APPID']; 
  const missing = requiredEnv.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.warn(`Missing environment variables on backend: ${missing.join(', ')}. AI functionality might be limited.`);
  }
  next();
});

// Basic route
app.get('/', (req, res) => {
  res.send('Chappie Backend is running and ready for duty!');
});

// Graceful shutdown
process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

function shutDown() {
  console.log('Signal received: closing SQLite connection');
  db.close((err) => {
    if (err) console.error('Error closing database:', err.message);
    else console.log('SQLite connection closed.');
    process.exit(err ? 1 : 0);
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
