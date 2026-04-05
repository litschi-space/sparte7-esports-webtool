# CONTEXT – Arcade Event @ Computer Museum Oldenburg

Dieses Dokument fasst den aktuellen Projektstand zusammen für die Weiterarbeit in Claude Code / VSCode.

---

## Projektübersicht

**Event:** Arcade Event – E-Sports Retro Gaming Event  
**Ort:** Computer Museum Oldenburg (OCM)  
**Veranstalter:** Oldenburgisches Staatstheater / Sparte 7

Ein Publikumsevent mit 12 Retro-Gaming-Stationen in der Ausstellung. Spieler registrieren sich digital, spielen an jeder Station einen Zyklus (z.B. 3 Leben), tragen ihren Score ein und werden auf einem Live-Leaderboard gerankt.

---

## Veranstaltungsaufbau

- ~100 Stühle in der Main Area
- Zentrale Moderationszone mit einem Spiel auf Leinwand
- „Rasende Reporterin" läuft live zwischen den 12 Stationen hin und her
- Livestream auf YouTube + Instagram
- Feste Kamera auf Stativ (ggf. Dreieck-Roller), iPhone auf Steady-Stativ als Mobile Cam
- PA vor Ort, FOH-Tisch und Stühle gestellt
- Deko: Sparte 7 bringt Material aus Tweelbäke mit

**Noch offen:**
- Eigenes WLAN-Netz für die VA einrichten
- Bandbreite für simultane Streams prüfen
- HF-Reichweite testen, ggf. Backup-Tonlösung für die Reporterin

---

## Web-Tool (Hauptprojekt)

Ein lokales Web-System für Spieler-Registrierung und Score-Tracking.

### Anforderungen
- Spieler registrieren sich mit **Gamertag** + **echtem Namen**
- 12 Stationen, jede mit eigenem Score
- Score-Eingabe: **Spieler selbst** (Ehrensystem) + **Admin/Staff**
- Live-Leaderboard (Gesamtpunktzahl aller Stationen)
- Admin-Panel mit Passwortschutz

### Aktueller Stand
Ein **React-Prototyp** (`esports-retro.jsx`) wurde erstellt mit:
- Registrierung, Gamertag-Lookup, Score-Eingabe pro Station
- Admin-Login (`museum2024`), Score-Korrektur, Spielerübersicht
- Live-Leaderboard mit Stations-Fortschrittsanzeige
- Dark/Neon-Ästhetik, CRT-Scanline-Effekt

### Nächster Schritt: Echtes Backend
Der Prototyp läuft nur im Browser (kein Datenpersistenz). Geplant ist ein **Node.js/Express + SQLite** Backend — analog zu bisherigen Projekten (Schranken-App, Signage-System).

**Geplante Architektur:**
```
/server
  index.js          # Express Server
  db.js             # SQLite Setup (better-sqlite3)
  routes/
    players.js      # POST /register, GET /players
    scores.js       # POST /score, GET /scores/:playerId
    admin.js        # Admin-Routen mit Auth

/client
  index.html        # Single-Page App (oder React Build)
```

**Endpoints (geplant):**
| Method | Route | Beschreibung |
|--------|-------|--------------|
| POST | `/api/register` | Spieler registrieren |
| GET | `/api/players` | Alle Spieler |
| POST | `/api/score` | Score eintragen |
| GET | `/api/leaderboard` | Rangliste |
| POST | `/api/admin/score` | Score überschreiben (Auth) |

---

## Stationen

| # | Spiel |
|---|-------|
| 1 | Pac-Man |
| 2 | Space Invaders |
| 3 | Donkey Kong |
| 4 | Tetris |
| 5 | Galaga |
| 6 | Frogger |
| 7 | Centipede |
| 8 | Asteroids |
| 9 | Missile Command |
| 10 | Defender |
| 11 | Robotron: 2084 |
| 12 | Q*bert |

---

## Tech-Stack & Konventionen

- **Frontend:** React (JSX) oder Vanilla HTML/JS/CSS
- **Backend:** Node.js + Express + better-sqlite3
- **Autostart:** Windows Task Scheduler (wie beim Signage-System)
- **Stil:** Dark/Neon, Monospace-Fonts, kein generisches Design
- **Sprache:** Deutsch (UI + Code-Kommentare nach Bedarf)

---

*Erstellt aus claude.ai Chatverlauf – Stand: April 2026*
