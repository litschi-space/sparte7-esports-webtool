import { useState, useMemo } from "react";

const STATIONS = [
  { id: 1, name: "Pac-Man", game: "Pac-Man", color: "#FFD700" },
  { id: 2, name: "Space Invaders", game: "Space Invaders", color: "#00FF41" },
  { id: 3, name: "Donkey Kong", game: "Donkey Kong", color: "#FF6B35" },
  { id: 4, name: "Tetris", game: "Tetris", color: "#00D4FF" },
  { id: 5, name: "Galaga", game: "Galaga", color: "#FF00FF" },
  { id: 6, name: "Frogger", game: "Frogger", color: "#7FFF00" },
  { id: 7, name: "Centipede", game: "Centipede", color: "#FF4444" },
  { id: 8, name: "Asteroids", game: "Asteroids", color: "#AAAAFF" },
  { id: 9, name: "Missile Command", game: "Missile Command", color: "#FF8C00" },
  { id: 10, name: "Defender", game: "Defender", color: "#00FFCC" },
  { id: 11, name: "Robotron", game: "Robotron: 2084", color: "#FF69B4" },
  { id: 12, name: "Q*bert", game: "Q*bert", color: "#FFA500" },
];

const ADMIN_PASSWORD = "museum2024";

const RANKS = ["🥇", "🥈", "🥉"];

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// CRT scanline overlay style
const crtStyle = {
  background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
  pointerEvents: "none",
  position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
};

export default function App() {
  const [view, setView] = useState("home"); // home | register | player | admin | adminLogin | leaderboard
  const [players, setPlayers] = useState([]);
  const [scores, setScores] = useState({}); // { playerId: { stationId: score } }
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPw, setAdminPw] = useState("");
  const [adminError, setAdminError] = useState("");

  // Register form
  const [regNick, setRegNick] = useState("");
  const [regName, setRegName] = useState("");
  const [regError, setRegError] = useState("");

  // Player score entry
  const [playerLookup, setPlayerLookup] = useState("");
  const [playerLookupResult, setPlayerLookupResult] = useState(null);
  const [playerLookupError, setPlayerLookupError] = useState("");
  const [scoreInputs, setScoreInputs] = useState({});
  const [scoreSaved, setScoreSaved] = useState({});

  // Admin score entry
  const [adminSelectedPlayer, setAdminSelectedPlayer] = useState("");
  const [adminScoreInputs, setAdminScoreInputs] = useState({});
  const [adminScoreSaved, setAdminScoreSaved] = useState({});

  const totalScore = (playerId) => {
    const s = scores[playerId] || {};
    return Object.values(s).reduce((a, b) => a + (parseInt(b) || 0), 0);
  };

  const leaderboard = useMemo(() => {
    return [...players]
      .map(p => ({ ...p, total: totalScore(p.id), stationCount: Object.keys(scores[p.id] || {}).length }))
      .sort((a, b) => b.total - a.total);
  }, [players, scores]);

  const registerPlayer = () => {
    if (!regNick.trim() || !regName.trim()) { setRegError("Bitte alle Felder ausfüllen."); return; }
    if (players.find(p => p.nick.toLowerCase() === regNick.trim().toLowerCase())) {
      setRegError("Dieser Gamertag ist bereits vergeben!"); return;
    }
    const newPlayer = { id: generateId(), nick: regNick.trim(), name: regName.trim(), registeredAt: new Date().toLocaleTimeString() };
    setPlayers(prev => [...prev, newPlayer]);
    setCurrentPlayer(newPlayer);
    setRegNick(""); setRegName(""); setRegError("");
    setView("player");
  };

  const lookupPlayer = () => {
    const found = players.find(p => p.nick.toLowerCase() === playerLookup.trim().toLowerCase());
    if (!found) { setPlayerLookupError("Gamertag nicht gefunden."); setPlayerLookupResult(null); return; }
    setPlayerLookupResult(found);
    setPlayerLookupError("");
    setScoreInputs(
      Object.fromEntries(Object.entries(scores[found.id] || {}).map(([k, v]) => [k, v]))
    );
    setScoreSaved({});
  };

  const savePlayerScore = (stationId) => {
    const val = parseInt(scoreInputs[stationId]);
    if (isNaN(val) || val < 0) return;
    setScores(prev => ({
      ...prev,
      [playerLookupResult.id]: { ...(prev[playerLookupResult.id] || {}), [stationId]: val }
    }));
    setScoreSaved(prev => ({ ...prev, [stationId]: true }));
    setTimeout(() => setScoreSaved(prev => ({ ...prev, [stationId]: false })), 2000);
  };

  const saveAdminScore = (stationId) => {
    if (!adminSelectedPlayer) return;
    const val = parseInt(adminScoreInputs[stationId]);
    if (isNaN(val) || val < 0) return;
    setScores(prev => ({
      ...prev,
      [adminSelectedPlayer]: { ...(prev[adminSelectedPlayer] || {}), [stationId]: val }
    }));
    setAdminScoreSaved(prev => ({ ...prev, [stationId]: true }));
    setTimeout(() => setAdminScoreSaved(prev => ({ ...prev, [stationId]: false })), 2000);
  };

  const adminLogin = () => {
    if (adminPw === ADMIN_PASSWORD) { setAdminUnlocked(true); setAdminError(""); setView("admin"); }
    else { setAdminError("Falsches Passwort!"); }
  };

  const selectedPlayerData = players.find(p => p.id === adminSelectedPlayer);

  // ── STYLES ──────────────────────────────────────────────────────────────────
  const s = {
    app: {
      minHeight: "100vh", background: "#0a0a0f", color: "#e0e0e0",
      fontFamily: "'Courier New', monospace", position: "relative", overflow: "hidden",
    },
    bg: {
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "radial-gradient(ellipse at 20% 50%, #1a0033 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, #003322 0%, transparent 50%), #0a0a0f",
      zIndex: 0,
    },
    wrap: { position: "relative", zIndex: 1, maxWidth: 860, margin: "0 auto", padding: "24px 16px", minHeight: "100vh" },

    logo: {
      textAlign: "center", marginBottom: 32,
      title: { fontSize: 38, fontWeight: 900, letterSpacing: 6, color: "#00FF41",
        textShadow: "0 0 20px #00FF41, 0 0 60px #00FF4155", fontFamily: "'Courier New', monospace" },
      sub: { fontSize: 12, letterSpacing: 8, color: "#888", marginTop: 4 },
    },

    card: {
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12, padding: 28, marginBottom: 20,
      boxShadow: "0 0 40px rgba(0,255,65,0.05)",
    },

    btn: (color = "#00FF41", outline = false) => ({
      background: outline ? "transparent" : color,
      color: outline ? color : "#000",
      border: `2px solid ${color}`,
      borderRadius: 6, padding: "10px 22px", fontFamily: "'Courier New', monospace",
      fontWeight: 700, fontSize: 13, letterSpacing: 2, cursor: "pointer",
      textTransform: "uppercase",
      boxShadow: outline ? "none" : `0 0 16px ${color}66`,
      transition: "all 0.15s",
    }),

    input: {
      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: 6, padding: "10px 14px", color: "#e0e0e0",
      fontFamily: "'Courier New', monospace", fontSize: 14, width: "100%", boxSizing: "border-box",
      outline: "none",
    },

    label: { fontSize: 11, letterSpacing: 3, color: "#888", textTransform: "uppercase", marginBottom: 6, display: "block" },

    navBar: {
      display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28,
      borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 16,
    },

    h2: { fontSize: 18, letterSpacing: 4, color: "#00FF41", textShadow: "0 0 10px #00FF4188", marginBottom: 20, textTransform: "uppercase" },
    h3: { fontSize: 13, letterSpacing: 3, color: "#aaa", textTransform: "uppercase", marginBottom: 12 },

    stationGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 },
    stationCard: (color, hasScore) => ({
      background: hasScore ? `${color}11` : "rgba(255,255,255,0.03)",
      border: `1px solid ${hasScore ? color : "rgba(255,255,255,0.08)"}`,
      borderRadius: 8, padding: "14px 16px",
      boxShadow: hasScore ? `0 0 12px ${color}33` : "none",
    }),

    leaderRow: (i) => ({
      display: "flex", alignItems: "center", gap: 14,
      padding: "12px 16px", marginBottom: 8, borderRadius: 8,
      background: i === 0 ? "rgba(255,215,0,0.08)" : i === 1 ? "rgba(192,192,192,0.06)" : i === 2 ? "rgba(205,127,50,0.06)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${i === 0 ? "#FFD70033" : i === 1 ? "#C0C0C033" : i === 2 ? "#CD7F3233" : "rgba(255,255,255,0.06)"}`,
    }),
  };

  // ── VIEWS ────────────────────────────────────────────────────────────────────

  const NavBar = () => (
    <div style={s.navBar}>
      <button style={s.btn(view === "home" ? "#00FF41" : "#444", view !== "home")} onClick={() => setView("home")}>🏠 Home</button>
      <button style={s.btn(view === "register" ? "#00D4FF" : "#444", view !== "register")} onClick={() => setView("register")}>➕ Registrieren</button>
      <button style={s.btn(view === "player" ? "#FF00FF" : "#444", view !== "player")} onClick={() => { setPlayerLookup(""); setPlayerLookupResult(null); setView("player"); }}>🎮 Score eintragen</button>
      <button style={s.btn(view === "leaderboard" ? "#FFD700" : "#444", view !== "leaderboard")} onClick={() => setView("leaderboard")}>🏆 Leaderboard</button>
      <button style={s.btn(view === "admin" ? "#FF6B35" : "#444", view !== "admin")} onClick={() => adminUnlocked ? setView("admin") : setView("adminLogin")}>⚙️ Admin</button>
    </div>
  );

  if (view === "home") return (
    <div style={s.app}>
      <div style={s.bg} />
      <div style={crtStyle} />
      <div style={s.wrap}>
        <NavBar />
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ fontSize: 60, marginBottom: 8 }}>🕹️</div>
          <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: 6, color: "#00FF41", textShadow: "0 0 30px #00FF41, 0 0 80px #00FF4144" }}>RETRO CLASH</div>
          <div style={{ fontSize: 11, letterSpacing: 10, color: "#555", margin: "8px 0 4px" }}>COMPUTER MUSEUM OLDENBURG</div>
          <div style={{ fontSize: 11, letterSpacing: 6, color: "#333" }}>E-SPORTS EVENT</div>

          <div style={{ display: "flex", justifyContent: "center", gap: 32, margin: "48px 0" }}>
            {[["👾", players.length, "Spieler"], ["🎮", "12", "Stationen"], ["🏆", leaderboard[0]?.nick || "—", "Führend"]].map(([icon, val, label]) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28 }}>{icon}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#00FF41", textShadow: "0 0 12px #00FF41" }}>{val}</div>
                <div style={{ fontSize: 10, letterSpacing: 3, color: "#666" }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button style={s.btn("#00FF41")} onClick={() => setView("register")}>🎮 Jetzt registrieren</button>
            <button style={s.btn("#FFD700", true)} onClick={() => setView("leaderboard")}>🏆 Rangliste ansehen</button>
          </div>

          <div style={{ marginTop: 48, padding: "20px 24px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", maxWidth: 480, margin: "48px auto 0" }}>
            <div style={{ fontSize: 11, letterSpacing: 3, color: "#888", marginBottom: 12 }}>SO FUNKTIONIERT'S</div>
            {["1. Registriere dich mit deinem Gamertag", "2. Spiele alle 12 Retro-Stationen durch", "3. Trage deinen Score nach jeder Station ein", "4. Wer hat am Ende die meisten Punkte?"].map(t => (
              <div key={t} style={{ fontSize: 13, color: "#aaa", marginBottom: 6, textAlign: "left" }}>▶ {t}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (view === "register") return (
    <div style={s.app}>
      <div style={s.bg} />
      <div style={crtStyle} />
      <div style={s.wrap}>
        <NavBar />
        <div style={s.h2}>➕ Spieler Registrierung</div>
        <div style={s.card}>
          <div style={{ marginBottom: 18 }}>
            <label style={s.label}>Gamertag / Nickname</label>
            <input style={s.input} value={regNick} onChange={e => setRegNick(e.target.value)} placeholder="z.B. PixelHero99" onKeyDown={e => e.key === "Enter" && registerPlayer()} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={s.label}>Echter Name</label>
            <input style={s.input} value={regName} onChange={e => setRegName(e.target.value)} placeholder="z.B. Max Mustermann" onKeyDown={e => e.key === "Enter" && registerPlayer()} />
          </div>
          {regError && <div style={{ color: "#FF4444", fontSize: 13, marginBottom: 16 }}>⚠ {regError}</div>}
          <button style={s.btn("#00FF41")} onClick={registerPlayer}>🎮 Registrieren & Starten</button>
        </div>

        {players.length > 0 && (
          <div style={s.card}>
            <div style={s.h3}>Bereits registriert ({players.length})</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {players.map(p => (
                <div key={p.id} style={{ background: "rgba(0,255,65,0.08)", border: "1px solid rgba(0,255,65,0.2)", borderRadius: 6, padding: "6px 12px", fontSize: 13 }}>
                  <span style={{ color: "#00FF41" }}>{p.nick}</span> <span style={{ color: "#555", fontSize: 11 }}>{p.registeredAt}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (view === "player") return (
    <div style={s.app}>
      <div style={s.bg} />
      <div style={crtStyle} />
      <div style={s.wrap}>
        <NavBar />
        <div style={s.h2}>🎮 Score eintragen</div>
        <div style={s.card}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={s.label}>Dein Gamertag</label>
              <input style={s.input} value={playerLookup} onChange={e => setPlayerLookup(e.target.value)} placeholder="Gamertag eingeben..." onKeyDown={e => e.key === "Enter" && lookupPlayer()} />
            </div>
            <button style={s.btn("#FF00FF")} onClick={lookupPlayer}>Suchen</button>
          </div>
          {playerLookupError && <div style={{ color: "#FF4444", fontSize: 13, marginTop: 12 }}>⚠ {playerLookupError}</div>}
        </div>

        {playerLookupResult && (() => {
          const p = playerLookupResult;
          const pScores = scores[p.id] || {};
          const total = totalScore(p.id);
          return (
            <>
              <div style={{ ...s.card, border: "1px solid #FF00FF44", boxShadow: "0 0 20px #FF00FF22" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#FF00FF" }}>{p.nick}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>{p.name}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 28, fontWeight: 900, color: "#FFD700", textShadow: "0 0 12px #FFD700" }}>{total.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: "#666", letterSpacing: 2 }}>GESAMT-SCORE</div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{Object.keys(pScores).length}/12 Stationen</div>
                  </div>
                </div>
              </div>

              <div style={s.stationGrid}>
                {STATIONS.map(st => {
                  const existingScore = pScores[st.id];
                  const val = scoreInputs[st.id] ?? (existingScore !== undefined ? existingScore : "");
                  const saved = scoreSaved[st.id];
                  return (
                    <div key={st.id} style={s.stationCard(st.color, existingScore !== undefined)}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 11, letterSpacing: 2, color: st.color }}>STATION {st.id}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#e0e0e0" }}>{st.name}</div>
                        </div>
                        {existingScore !== undefined && <div style={{ fontSize: 11, color: st.color, fontWeight: 900 }}>✓</div>}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          style={{ ...s.input, fontSize: 13, padding: "7px 10px" }}
                          type="number" min="0"
                          value={val}
                          onChange={e => setScoreInputs(prev => ({ ...prev, [st.id]: e.target.value }))}
                          placeholder="Score..."
                          onKeyDown={e => e.key === "Enter" && savePlayerScore(st.id)}
                        />
                        <button
                          style={{ ...s.btn(saved ? "#00FF41" : st.color), padding: "7px 12px", fontSize: 11, minWidth: 48 }}
                          onClick={() => savePlayerScore(st.id)}
                        >{saved ? "✓" : "OK"}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );

  if (view === "leaderboard") return (
    <div style={s.app}>
      <div style={s.bg} />
      <div style={crtStyle} />
      <div style={s.wrap}>
        <NavBar />
        <div style={s.h2}>🏆 Rangliste</div>
        {leaderboard.length === 0 ? (
          <div style={{ ...s.card, textAlign: "center", color: "#555", padding: 48 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>👾</div>
            Noch keine Spieler registriert.
          </div>
        ) : leaderboard.map((p, i) => (
          <div key={p.id} style={s.leaderRow(i)}>
            <div style={{ fontSize: 24, minWidth: 32 }}>{RANKS[i] || `${i + 1}.`}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 15, color: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#e0e0e0" }}>{p.nick}</div>
              <div style={{ fontSize: 11, color: "#555" }}>{p.name} · {p.stationCount}/12 Stationen</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 900, fontSize: 20, color: i < 3 ? "#FFD700" : "#e0e0e0", textShadow: i === 0 ? "0 0 12px #FFD700" : "none" }}>{p.total.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 2 }}>PTS</div>
            </div>
            <div style={{ display: "flex", gap: 3 }}>
              {STATIONS.map(st => {
                const hasScore = (scores[p.id] || {})[st.id] !== undefined;
                return <div key={st.id} style={{ width: 6, height: 6, borderRadius: 2, background: hasScore ? st.color : "rgba(255,255,255,0.1)" }} title={st.name} />;
              })}
            </div>
          </div>
        ))}
        {leaderboard.length > 0 && (
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "#444", letterSpacing: 2 }}>
            {leaderboard.length} SPIELER · {STATIONS.length} STATIONEN
          </div>
        )}
      </div>
    </div>
  );

  if (view === "adminLogin") return (
    <div style={s.app}>
      <div style={s.bg} />
      <div style={crtStyle} />
      <div style={s.wrap}>
        <NavBar />
        <div style={{ maxWidth: 360, margin: "60px auto" }}>
          <div style={s.h2}>⚙️ Admin Login</div>
          <div style={s.card}>
            <label style={s.label}>Passwort</label>
            <input style={{ ...s.input, marginBottom: 16 }} type="password" value={adminPw} onChange={e => setAdminPw(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && adminLogin()} />
            {adminError && <div style={{ color: "#FF4444", fontSize: 13, marginBottom: 14 }}>⚠ {adminError}</div>}
            <button style={s.btn("#FF6B35")} onClick={adminLogin}>Einloggen</button>
            <div style={{ fontSize: 11, color: "#444", marginTop: 12 }}>Demo-Passwort: museum2024</div>
          </div>
        </div>
      </div>
    </div>
  );

  if (view === "admin") return (
    <div style={s.app}>
      <div style={s.bg} />
      <div style={crtStyle} />
      <div style={s.wrap}>
        <NavBar />
        <div style={s.h2}>⚙️ Admin Panel</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
          {[
            ["👾", players.length, "Registrierte Spieler"],
            ["✅", Object.values(scores).flatMap(Object.values).length, "Eingetragene Scores"],
            ["🏆", leaderboard[0]?.nick || "—", "Aktuell führend"],
            ["⭐", leaderboard[0]?.total?.toLocaleString() || "0", "Höchste Punktzahl"],
          ].map(([icon, val, label]) => (
            <div key={label} style={{ ...s.card, padding: "16px 20px" }}>
              <div style={{ fontSize: 20 }}>{icon}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#FF6B35" }}>{val}</div>
              <div style={{ fontSize: 11, color: "#666", letterSpacing: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={s.card}>
          <div style={s.h3}>Score für Spieler eintragen / korrigieren</div>
          <select
            style={{ ...s.input, marginBottom: 16 }}
            value={adminSelectedPlayer}
            onChange={e => {
              setAdminSelectedPlayer(e.target.value);
              setAdminScoreInputs(Object.fromEntries(Object.entries(scores[e.target.value] || {}).map(([k, v]) => [k, v])));
              setAdminScoreSaved({});
            }}
          >
            <option value="">— Spieler auswählen —</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.nick} ({p.name})</option>)}
          </select>

          {adminSelectedPlayer && (
            <div style={s.stationGrid}>
              {STATIONS.map(st => {
                const existingScore = (scores[adminSelectedPlayer] || {})[st.id];
                const val = adminScoreInputs[st.id] ?? (existingScore !== undefined ? existingScore : "");
                const saved = adminScoreSaved[st.id];
                return (
                  <div key={st.id} style={s.stationCard(st.color, existingScore !== undefined)}>
                    <div style={{ fontSize: 11, letterSpacing: 2, color: st.color, marginBottom: 4 }}>STATION {st.id} · {st.name}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        style={{ ...s.input, fontSize: 13, padding: "7px 10px" }}
                        type="number" min="0"
                        value={val}
                        onChange={e => setAdminScoreInputs(prev => ({ ...prev, [st.id]: e.target.value }))}
                        placeholder="Score..."
                        onKeyDown={e => e.key === "Enter" && saveAdminScore(st.id)}
                      />
                      <button
                        style={{ ...s.btn(saved ? "#00FF41" : st.color), padding: "7px 12px", fontSize: 11, minWidth: 48 }}
                        onClick={() => saveAdminScore(st.id)}
                      >{saved ? "✓" : "OK"}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={s.card}>
          <div style={s.h3}>Alle Spieler & Scores</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: "#888", fontSize: 11, letterSpacing: 2, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>GAMERTAG</th>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: "#888", fontSize: 11, letterSpacing: 2, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>NAME</th>
                  <th style={{ textAlign: "right", padding: "8px 10px", color: "#888", fontSize: 11, letterSpacing: 2, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>STATIONEN</th>
                  <th style={{ textAlign: "right", padding: "8px 10px", color: "#FFD700", fontSize: 11, letterSpacing: 2, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>GESAMT</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "8px 10px", color: "#00FF41", fontWeight: 700 }}>{RANKS[i] || `${i+1}.`} {p.nick}</td>
                    <td style={{ padding: "8px 10px", color: "#aaa" }}>{p.name}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#888" }}>{p.stationCount}/12</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#FFD700", fontWeight: 900 }}>{p.total.toLocaleString()}</td>
                  </tr>
                ))}
                {players.length === 0 && <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", color: "#444" }}>Noch keine Spieler</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  return null;
}
