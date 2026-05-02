const isPg = !!process.env.DATABASE_URL;

// Konvertiert SQLite-? Platzhalter zu PostgreSQL-$1,$2,...
function toPositional(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

let _query, _init;

if (isPg) {
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  _query = async (sql, params = []) => {
    const res = await pool.query(toPositional(sql), params);
    return { rows: res.rows, lastInsertId: res.rows[0]?.id };
  };

  _init = async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        CREATE TABLE IF NOT EXISTS players (
          id SERIAL PRIMARY KEY,
          gamertag TEXT UNIQUE NOT NULL,
          realname TEXT NOT NULL,
          team TEXT NOT NULL DEFAULT 'blau',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS scores (
          id SERIAL PRIMARY KEY,
          player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
          station INTEGER NOT NULL CHECK(station BETWEEN 1 AND 12),
          score INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(player_id, station)
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);
      await client.query(
        `ALTER TABLE players ADD COLUMN IF NOT EXISTS team TEXT NOT NULL DEFAULT 'blau'`
      ).catch(() => {});
      await client.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
        ["registration_open", "true"]
      );
      await client.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
        ["scoring_open", "true"]
      );
      await client.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
        ["event_start", ""]
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  };

} else {
  const { DatabaseSync } = require("node:sqlite");
  const path = require("path");
  const fs = require("fs");

  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const sqlite = new DatabaseSync(path.join(dataDir, "retro.db"));
  sqlite.exec("PRAGMA journal_mode = WAL");

  _query = async (sql, params = []) => {
    const trimmed = sql.trim().toUpperCase();
    const returnsRows = trimmed.startsWith("SELECT") || trimmed.startsWith("WITH") || trimmed.includes("RETURNING");
    const stmt = sqlite.prepare(sql);
    if (returnsRows) {
      const rows = params.length ? stmt.all(...params) : stmt.all();
      return { rows, lastInsertId: rows[0]?.id };
    } else {
      const result = params.length ? stmt.run(...params) : stmt.run();
      return { rows: [], lastInsertId: Number(result.lastInsertRowid) };
    }
  };

  _init = async () => {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gamertag TEXT UNIQUE NOT NULL COLLATE NOCASE,
        realname TEXT NOT NULL,
        team TEXT NOT NULL DEFAULT 'blau',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        station INTEGER NOT NULL CHECK(station BETWEEN 1 AND 12),
        score INTEGER NOT NULL DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(player_id, station)
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    try { sqlite.exec("ALTER TABLE players ADD COLUMN team TEXT NOT NULL DEFAULT 'blau'"); } catch (_) {}
    sqlite.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run("registration_open", "true");
    sqlite.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run("scoring_open", "true");
    sqlite.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run("event_start", "");
  };
}

// Einheitliche API
const db = {
  isPg,

  // Gibt { rows } zurück
  async query(sql, params = []) {
    return _query(sql, params);
  },

  // Gibt erste Zeile oder undefined zurück
  async queryOne(sql, params = []) {
    const { rows } = await _query(sql, params);
    return rows[0];
  },

  // Gibt { lastInsertId } zurück
  async run(sql, params = []) {
    return _query(sql, params);
  },

  // Schema-Initialisierung
  async init() {
    return _init();
  },
};

module.exports = db;
