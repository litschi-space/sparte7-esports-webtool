const express = require("express");
const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3001;

// Datenbank-Verzeichnis anlegen
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, "retro.db"));

// WAL-Modus für bessere Performance
db.exec("PRAGMA journal_mode = WAL");

// Schema initialisieren
db.exec(`
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

db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run("registration_open", "true");

// team-Spalte für bestehende DBs nachrüsten (schlägt still fehl wenn schon vorhanden)
try { db.exec("ALTER TABLE players ADD COLUMN team TEXT NOT NULL DEFAULT 'blau'"); } catch (_) {}

app.use(express.json());

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "museum2024";
const TEAMS = ["blau", "gelb", "gruen", "rot"];

// Registrierungen an/aus – aus DB lesen, überlebt Server-Neustarts
let registrationOpen = db.prepare("SELECT value FROM settings WHERE key = ?").get("registration_open")?.value !== "false";

// Scoring an/aus – aus DB lesen, überlebt Server-Neustarts
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run("scoring_open", "true");
let scoringOpen = db.prepare("SELECT value FROM settings WHERE key = ?").get("scoring_open")?.value !== "false";

// GET /api/registration-status – aktuellen Status abfragen
app.get("/api/registration-status", (req, res) => {
  res.json({ open: registrationOpen });
});

// POST /api/admin/registration-status – Status setzen (Admin)
app.post("/api/admin/registration-status", requireAdmin, (req, res) => {
  const { open } = req.body || {};
  if (typeof open !== "boolean") return res.status(400).json({ error: "Ungültige Eingabe" });
  registrationOpen = open;
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("registration_open", String(open));
  res.json({ open: registrationOpen });
});

// Event-Start – aus DB lesen
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run("event_start", "");
let eventStart = db.prepare("SELECT value FROM settings WHERE key = ?").get("event_start")?.value || "";

// GET /api/event-start – aktuellen Zielzeitpunkt abfragen
app.get("/api/event-start", (req, res) => res.json({ eventStart }));

// POST /api/admin/event-start – Zielzeitpunkt setzen (Admin)
app.post("/api/admin/event-start", requireAdmin, (req, res) => {
  const { value } = req.body || {};
  eventStart = typeof value === "string" ? value : "";
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("event_start", eventStart);
  res.json({ eventStart });
});

// GET /api/scoring-status – aktuellen Status abfragen
app.get("/api/scoring-status", (req, res) => {
  res.json({ open: scoringOpen });
});

// POST /api/admin/scoring-status – Status setzen (Admin)
app.post("/api/admin/scoring-status", requireAdmin, (req, res) => {
  const { open } = req.body || {};
  if (typeof open !== "boolean") return res.status(400).json({ error: "Ungültige Eingabe" });
  scoringOpen = open;
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("scoring_open", String(open));
  res.json({ open: scoringOpen });
});

function requireAdmin(req, res, next) {
  if (req.headers["authorization"] !== `Bearer ${ADMIN_PASSWORD}`) {
    return res.status(401).json({ error: "Nicht autorisiert" });
  }
  next();
}

function formatTime(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleTimeString("de-DE");
}

// POST /api/register – Spieler registrieren
app.post("/api/register", (req, res) => {
  if (!registrationOpen) {
    return res.status(403).json({ error: "Die Registrierung ist aktuell geschlossen." });
  }
  const { gamertag, realname, team } = req.body || {};
  if (!gamertag?.trim() || !realname?.trim()) {
    return res.status(400).json({ error: "Bitte alle Felder ausfüllen." });
  }
  const assignedTeam = TEAMS.includes(team) ? team : TEAMS[Math.floor(Math.random() * TEAMS.length)];
  try {
    const result = db
      .prepare("INSERT INTO players (gamertag, realname, team) VALUES (?, ?, ?)")
      .run(gamertag.trim(), realname.trim(), assignedTeam);
    const player = db
      .prepare("SELECT * FROM players WHERE id = ?")
      .get(Number(result.lastInsertRowid));
    res.json({
      id: player.id,
      nick: player.gamertag,
      name: player.realname,
      team: player.team,
      registeredAt: formatTime(player.created_at),
    });
  } catch (e) {
    if (e.message.includes("UNIQUE")) {
      return res.status(409).json({ error: "Dieser Gamertag ist bereits vergeben!" });
    }
    console.error(e);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/players – Alle Spieler (nach Registrierungszeit)
app.get("/api/players", (req, res) => {
  const rows = db
    .prepare("SELECT id, gamertag AS nick, realname AS name, team, created_at FROM players ORDER BY created_at ASC")
    .all();
  res.json(rows.map((p) => ({ ...p, registeredAt: formatTime(p.created_at) })));
});

// POST /api/score – Score eintragen oder aktualisieren
app.post("/api/score", (req, res) => {
  if (!scoringOpen) return res.status(403).json({ error: "Scoring ist aktuell deaktiviert" });
  const { gamertag, station, score } = req.body || {};
  const val = parseInt(score);
  const st = parseInt(station);
  if (!gamertag || isNaN(val) || val < 0 || isNaN(st) || st < 1 || st > 12) {
    return res.status(400).json({ error: "Ungültige Eingabe" });
  }
  const player = db.prepare("SELECT id FROM players WHERE gamertag = ?").get(gamertag);
  if (!player) return res.status(404).json({ error: "Spieler nicht gefunden" });

  db.prepare(`
    INSERT INTO scores (player_id, station, score)
    VALUES (?, ?, ?)
    ON CONFLICT(player_id, station) DO UPDATE
      SET score = excluded.score, updated_at = CURRENT_TIMESTAMP
  `).run(player.id, st, val);

  res.json({ ok: true });
});

// GET /api/leaderboard – Rangliste mit Scores pro Spieler
app.get("/api/leaderboard", (req, res) => {
  const players = db.prepare(`
    SELECT p.id, p.gamertag AS nick, p.realname AS name, p.team,
           COALESCE(SUM(s.score), 0) AS total,
           COUNT(s.station) AS stationCount
    FROM players p
    LEFT JOIN scores s ON s.player_id = p.id
    GROUP BY p.id
    ORDER BY total DESC, p.created_at ASC
  `).all();

  const getScores = db.prepare("SELECT station, score FROM scores WHERE player_id = ?");
  const result = players.map((p) => {
    const scoresObj = {};
    getScores.all(p.id).forEach((s) => { scoresObj[s.station] = s.score; });
    return { ...p, scores: scoresObj };
  });

  res.json(result);
});

// GET /api/team-scores – Gesamtpunkte pro Team
app.get("/api/team-scores", (req, res) => {
  const rows = db.prepare(`
    SELECT p.team,
           COALESCE(SUM(s.score), 0) AS total,
           COUNT(DISTINCT p.id) AS members
    FROM players p
    LEFT JOIN scores s ON s.player_id = p.id
    GROUP BY p.team
  `).all();
  res.json(rows);
});

// POST /api/admin/score – Score überschreiben (Admin)
app.post("/api/admin/score", requireAdmin, (req, res) => {
  const { gamertag, station, score } = req.body || {};
  const val = parseInt(score);
  const st = parseInt(station);
  if (!gamertag || isNaN(val) || val < 0 || isNaN(st) || st < 1 || st > 12) {
    return res.status(400).json({ error: "Ungültige Eingabe" });
  }
  const player = db.prepare("SELECT id FROM players WHERE gamertag = ?").get(gamertag);
  if (!player) return res.status(404).json({ error: "Spieler nicht gefunden" });

  db.prepare(`
    INSERT INTO scores (player_id, station, score)
    VALUES (?, ?, ?)
    ON CONFLICT(player_id, station) DO UPDATE
      SET score = excluded.score, updated_at = CURRENT_TIMESTAMP
  `).run(player.id, st, val);

  res.json({ ok: true });
});

// DELETE /api/player/self – Eigenen Account löschen (kein Auth nötig, nur per Gamertag)
app.delete("/api/player/self", (req, res) => {
  const { gamertag } = req.body || {};
  if (!gamertag?.trim()) return res.status(400).json({ error: "Kein Gamertag angegeben." });
  db.prepare("DELETE FROM players WHERE gamertag = ?").run(gamertag.trim());
  res.json({ ok: true });
});

// DELETE /api/admin/player/:id – Spieler löschen (Admin)
app.delete("/api/admin/player/:id", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Ungültige ID" });
  db.prepare("DELETE FROM players WHERE id = ?").run(id);
  res.json({ ok: true });
});

// GET /health – Server-Status
app.get("/health", (req, res) => {
  const playerCount = db.prepare("SELECT COUNT(*) AS n FROM players").get().n;
  const scoreCount = db.prepare("SELECT COUNT(*) AS n FROM scores").get().n;
  res.json({ ok: true, players: playerCount, scores: scoreCount, registrationOpen, uptime: Math.floor(process.uptime()) });
});

// Produktion: Vite-Build aus /dist servieren
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "..", "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🕹️  Arcade Event Backend läuft auf http://localhost:${PORT}`);
  console.log(`📂  Datenbank: ${path.join(dataDir, "retro.db")}`);
});
