const express = require("express");
const path = require("path");
const db = require("./db");
const { Filter } = require("bad-words");

const profanityFilter = new Filter();
profanityFilter.addWords(
  "scheiße", "scheisse", "scheißer", "scheiß", "scheiss",
  "arsch", "arschloch", "wichser", "wichse", "fick", "ficken",
  "hurensohn", "hure", "nutte", "fotze", "schwanz", "pimmel",
  "nazi", "hitler", "neger", "nigger", "kanake"
);

const app = express();
const PORT = 3001;

app.use(express.json());

const ADMIN_PASSWORD = "museum2024";
const TEAMS = ["blau", "gelb", "gruen", "rot"];

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

// GET /api/registration-status
app.get("/api/registration-status", async (req, res) => {
  const row = await db.queryOne("SELECT value FROM settings WHERE key = ?", ["registration_open"]);
  res.json({ open: row?.value !== "false" });
});

// POST /api/admin/registration-status
app.post("/api/admin/registration-status", requireAdmin, async (req, res) => {
  const { open } = req.body || {};
  if (typeof open !== "boolean") return res.status(400).json({ error: "Ungültige Eingabe" });
  await db.run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ["registration_open", String(open)]
  );
  res.json({ open });
});

// GET /api/scoring-status
app.get("/api/scoring-status", async (req, res) => {
  const row = await db.queryOne("SELECT value FROM settings WHERE key = ?", ["scoring_open"]);
  res.json({ open: row?.value !== "false" });
});

// POST /api/admin/scoring-status
app.post("/api/admin/scoring-status", requireAdmin, async (req, res) => {
  const { open } = req.body || {};
  if (typeof open !== "boolean") return res.status(400).json({ error: "Ungültige Eingabe" });
  await db.run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ["scoring_open", String(open)]
  );
  res.json({ open });
});

// GET /api/event-start
app.get("/api/event-start", async (req, res) => {
  const row = await db.queryOne("SELECT value FROM settings WHERE key = ?", ["event_start"]);
  res.json({ eventStart: row?.value || "" });
});

// POST /api/admin/event-start
app.post("/api/admin/event-start", requireAdmin, async (req, res) => {
  const { value } = req.body || {};
  const eventStart = typeof value === "string" ? value : "";
  await db.run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ["event_start", eventStart]
  );
  res.json({ eventStart });
});

// POST /api/register
app.post("/api/register", async (req, res) => {
  const regRow = await db.queryOne("SELECT value FROM settings WHERE key = ?", ["registration_open"]);
  if (regRow?.value === "false") {
    return res.status(403).json({ error: "Die Registrierung ist aktuell geschlossen." });
  }
  const { gamertag, realname, team } = req.body || {};
  if (!gamertag?.trim() || !realname?.trim()) {
    return res.status(400).json({ error: "Bitte alle Felder ausfüllen." });
  }
  if (profanityFilter.isProfane(gamertag.trim()) || profanityFilter.isProfane(realname.trim())) {
    return res.status(400).json({ error: "Bitte wähle einen angemessenen Namen." });
  }
  const assignedTeam = TEAMS.includes(team) ? team : TEAMS[Math.floor(Math.random() * TEAMS.length)];
  try {
    const { rows } = await db.query(
      "INSERT INTO players (gamertag, realname, team) VALUES (?, ?, ?) RETURNING *",
      [gamertag.trim(), realname.trim(), assignedTeam]
    );
    const player = rows[0];
    res.json({
      id: player.id,
      nick: player.gamertag,
      name: player.realname,
      team: player.team,
      registeredAt: formatTime(player.created_at),
    });
  } catch (e) {
    if (e.message?.includes("UNIQUE") || e.message?.includes("unique")) {
      return res.status(409).json({ error: "Dieser Gamertag ist bereits vergeben!" });
    }
    console.error(e);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/players
app.get("/api/players", async (req, res) => {
  const { rows } = await db.query(
    "SELECT id, gamertag AS nick, realname AS name, team, created_at FROM players ORDER BY created_at ASC"
  );
  res.json(rows.map((p) => ({ ...p, registeredAt: formatTime(p.created_at) })));
});

// POST /api/score
app.post("/api/score", async (req, res) => {
  const scoringRow = await db.queryOne("SELECT value FROM settings WHERE key = ?", ["scoring_open"]);
  if (scoringRow?.value === "false") return res.status(403).json({ error: "Scoring ist aktuell deaktiviert" });

  const { gamertag, station, score } = req.body || {};
  const val = parseInt(score);
  const st = parseInt(station);
  if (!gamertag || isNaN(val) || val < 0 || isNaN(st) || st < 1 || st > 12) {
    return res.status(400).json({ error: "Ungültige Eingabe" });
  }
  const player = await db.queryOne("SELECT id FROM players WHERE gamertag = ?", [gamertag]);
  if (!player) return res.status(404).json({ error: "Spieler nicht gefunden" });

  await db.run(
    `INSERT INTO scores (player_id, station, score)
     VALUES (?, ?, ?)
     ON CONFLICT(player_id, station) DO UPDATE
       SET score = excluded.score, updated_at = CURRENT_TIMESTAMP`,
    [player.id, st, val]
  );
  res.json({ ok: true });
});

// GET /api/leaderboard
app.get("/api/leaderboard", async (req, res) => {
  const { rows: players } = await db.query(`
    SELECT p.id, p.gamertag AS nick, p.realname AS name, p.team,
           CAST(COALESCE(SUM(s.score), 0) AS INTEGER) AS total,
           CAST(COUNT(s.station) AS INTEGER) AS "stationCount"
    FROM players p
    LEFT JOIN scores s ON s.player_id = p.id
    GROUP BY p.id, p.gamertag, p.realname, p.team, p.created_at
    ORDER BY total DESC, p.created_at ASC
  `);

  const result = await Promise.all(players.map(async (p) => {
    const { rows: scoreRows } = await db.query(
      "SELECT station, score FROM scores WHERE player_id = ?",
      [p.id]
    );
    const scoresObj = {};
    scoreRows.forEach((s) => { scoresObj[s.station] = s.score; });
    return { ...p, scores: scoresObj };
  }));

  res.json(result);
});

// GET /api/team-scores
app.get("/api/team-scores", async (req, res) => {
  const { rows } = await db.query(`
    SELECT p.team,
           COALESCE(SUM(s.score), 0) AS total,
           COUNT(DISTINCT p.id) AS members
    FROM players p
    LEFT JOIN scores s ON s.player_id = p.id
    GROUP BY p.team
  `);
  res.json(rows);
});

// POST /api/admin/score
app.post("/api/admin/score", requireAdmin, async (req, res) => {
  const { gamertag, station, score } = req.body || {};
  const val = parseInt(score);
  const st = parseInt(station);
  if (!gamertag || isNaN(val) || val < 0 || isNaN(st) || st < 1 || st > 12) {
    return res.status(400).json({ error: "Ungültige Eingabe" });
  }
  const player = await db.queryOne("SELECT id FROM players WHERE gamertag = ?", [gamertag]);
  if (!player) return res.status(404).json({ error: "Spieler nicht gefunden" });

  await db.run(
    `INSERT INTO scores (player_id, station, score)
     VALUES (?, ?, ?)
     ON CONFLICT(player_id, station) DO UPDATE
       SET score = excluded.score, updated_at = CURRENT_TIMESTAMP`,
    [player.id, st, val]
  );
  res.json({ ok: true });
});

// DELETE /api/unregister
app.delete("/api/unregister", async (req, res) => {
  const { gamertag } = req.body || {};
  if (!gamertag?.trim()) return res.status(400).json({ error: "Kein Gamertag angegeben" });
  await db.run("DELETE FROM players WHERE gamertag = ?", [gamertag.trim()]);
  res.json({ ok: true });
});

// DELETE /api/admin/player/:id
app.delete("/api/admin/player/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Ungültige ID" });
  await db.run("DELETE FROM players WHERE id = ?", [id]);
  res.json({ ok: true });
});

// GET /health
app.get("/health", async (req, res) => {
  const playerRow = await db.queryOne("SELECT COUNT(*) AS n FROM players");
  const scoreRow = await db.queryOne("SELECT COUNT(*) AS n FROM scores");
  const regRow = await db.queryOne("SELECT value FROM settings WHERE key = ?", ["registration_open"]);
  res.json({
    ok: true,
    players: playerRow?.n ?? 0,
    scores: scoreRow?.n ?? 0,
    registrationOpen: regRow?.value !== "false",
    uptime: Math.floor(process.uptime()),
    db: db.isPg ? "postgres" : "sqlite",
  });
});

// Produktion: Vite-Build aus /dist servieren
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "..", "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🕹️  Retro Clash Backend läuft auf http://localhost:${PORT}`);
      console.log(`🗄️  Datenbank: ${db.isPg ? "PostgreSQL" : "SQLite (lokal)"}`);
    });
  })
  .catch((err) => {
    console.error("DB-Initialisierung fehlgeschlagen:", err);
    process.exit(1);
  });
