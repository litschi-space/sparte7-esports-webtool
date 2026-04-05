import { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";

const STATIONS = [
  { id: 1,  name: "Jupiter Lander",    game: "Jupiter Lander",    color: "#6A5AFF" },
  { id: 2,  name: "Donkey Kong",       game: "Donkey Kong",       color: "#FF6B35" },
  { id: 3,  name: "Antarctic Adventure", game: "Antarctic Adventure", color: "#00D4FF" },
  { id: 4,  name: "Space Invaders",    game: "Space Invaders",    color: "#00FF41" },
  { id: 5,  name: "Puck Man",          game: "Puck Man",          color: "#FFD700" },
  { id: 6,  name: "Cosmic Alien",      game: "Cosmic Alien",      color: "#CC44FF" },
  { id: 7,  name: "Dyna Blaster",      game: "Dyna Blaster",      color: "#FF4444" },
  { id: 8,  name: "Super Mario Bros 1", game: "Super Mario Bros 1", color: "#FF2222" },
  { id: 9,  name: "Mine Storm",        game: "Mine Storm",        color: "#00FFCC" },
  { id: 10, name: "Pong",              game: "Pong",              color: "#EEEEEE" },
  { id: 11, name: "Donkey Conga",      game: "Donkey Conga",      color: "#FFA500" },
  { id: 12, name: "Dance Sim",         game: "Dance Sim",         color: "#FF69B4" },
];

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "museum2024";
const HELPER_PASSWORD = import.meta.env.VITE_HELPER_PASSWORD || "helfer2024";

const RANKS = ["🥇", "🥈", "🥉"];

const TEAMS = {
  blau:  { label: "Team Blau",  color: "#00D4FF", bg: "rgba(0,212,255,0.12)"  },
  gelb:  { label: "Team Gelb",  color: "#FFD700", bg: "rgba(255,215,0,0.12)"  },
  gruen: { label: "Team Grün",  color: "#00FF41", bg: "rgba(0,255,65,0.12)"   },
  rot:   { label: "Team Rot",   color: "#FF4444", bg: "rgba(255,68,68,0.12)"  },
};

const Footer = () => (
  <footer style={{ textAlign: "center", padding: "32px 0 20px", color: "#444", fontSize: 12, letterSpacing: 1 }}>
    <style>{`@keyframes heartColor{0%{color:#ff4d4d}20%{color:#ffa64d}40%{color:#ffd700}60%{color:#00e676}80%{color:#4d94ff}100%{color:#ff4d4d}}`}</style>
    <p style={{ fontWeight: 700, letterSpacing: 4, color: "#777777", marginBottom: 6 }}>SPARTE7 ✖ OCM e.V.</p>
    <p style={{ marginBottom: 6 }}></p>
    <p style={{ marginBottom: 6 }}>Erstellt mit <span style={{ animation: "heartColor 5s linear infinite", fontSize: 16, display: "inline-block", transform: "scaleX(1.3)" }}>♥</span> von Richard Schneider</p>
    <p style={{ marginBottom: 12 }}>©2026 | <a href="https://litschi.space/Impressum.html" style={{ color: "#555", textDecoration: "underline" }}>Impressum</a> | <a href="https://litschi.space/" style={{ color: "#33ffe493" }}>litschi.space</a></p>
    <p>🏳️‍🌈</p>
  </footer>
);

const TeamBadge = ({ team, style = {} }) => {
  const t = TEAMS[team];
  if (!t) return null;
  return (
    <span style={{
      display: "inline-block", padding: "2px 9px", borderRadius: 20,
      fontSize: 10, fontWeight: 700, letterSpacing: 2, fontFamily: "'Courier New', monospace",
      background: t.bg, color: t.color, border: `1px solid ${t.color}55`,
      textTransform: "uppercase", ...style,
    }}>{t.label}</span>
  );
};

// Persistenz-Utilities (localStorage — zuverlässiger als Cookies für SPAs)
const saveRegistration = (nick) => localStorage.setItem("retro_gamertag", nick);
const loadRegistration = () => localStorage.getItem("retro_gamertag");

// CRT scanline overlay style
const crtStyle = {
  background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
  pointerEvents: "none",
  position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
};

export default function App() {
  // /helfer URL → Spielhelfer-Modus (kein normales Routing, kein NavBar)
  const isHelperMode = window.location.pathname === "/helfer";
  const isAdminMode = window.location.pathname === "/admin";
  const isTableMode = window.location.pathname === "/table";

  const [view, setView] = useState(
    isHelperMode ? "helferLogin" : isAdminMode ? "adminLogin" : isTableMode ? "table" : "home"
  );
  const [players, setPlayers] = useState([]);
  const [scores, setScores] = useState({}); // { playerId: { stationId: score } }
  const [leaderboard, setLeaderboard] = useState([]);
  // Gamertag aus Cookie – gesetzt nach erfolgreicher Registrierung
  const [registeredAs, setRegisteredAs] = useState(() => loadRegistration());
  const [dataLoaded, setDataLoaded] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [scoringOpen, setScoringOpen] = useState(true);
  const [eventStart, setEventStart] = useState("");
  const [adminEventStart, setAdminEventStart] = useState("");
  const [registrationSuccess, setRegistrationSuccess] = useState(null); // gespeicherter Spieler nach Reg.
  const [teamScores, setTeamScores] = useState([]);
  const [leaderboardTab, setLeaderboardTab] = useState("spieler"); // "spieler" | "teams"
  const [regTeam, setRegTeam] = useState(null); // gewähltes Team bei Registrierung (null = random)
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPw, setAdminPw] = useState("");
  const [adminError, setAdminError] = useState("");
  const [helperPw, setHelperPw] = useState("");
  const [helperLoginError, setHelperLoginError] = useState("");

  // Register form
  const [regNick, setRegNick] = useState("");
  const [regName, setRegName] = useState("");
  const [regError, setRegError] = useState("");

  // Admin score entry
  const [adminSelectedPlayer, setAdminSelectedPlayer] = useState("");
  const [adminScoreInputs, setAdminScoreInputs] = useState({});
  const [adminScoreSaved, setAdminScoreSaved] = useState({});

  // Spielhelfer
  const [helperStation, setHelperStation] = useState(null);
  const [helperLookup, setHelperLookup] = useState("");
  const [helperPlayer, setHelperPlayer] = useState(null);
  const [helperError, setHelperError] = useState("");
  const [helperScore, setHelperScore] = useState("");
  const [helperSuccess, setHelperSuccess] = useState(false);

  // QR
  const [qrModal, setQrModal] = useState(null); // gamertag string or null
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  // QR-Code generieren wenn Modal geöffnet wird
  useEffect(() => {
    if (!qrModal) { setQrDataUrl(null); return; }
    QRCode.toDataURL(qrModal, { width: 220, margin: 2, color: { dark: "#000", light: "#fff" } })
      .then(setQrDataUrl);
  }, [qrModal]);

  const stopScanner = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setScannerOpen(false);
  }, []);

  const startScanner = useCallback(async () => {
    setScannerOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      // video ref wird im nächsten Render gesetzt — kurz warten
      setTimeout(() => {
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        const tick = () => {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
            rafRef.current = requestAnimationFrame(tick);
            return;
          }
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code?.data) {
            stopScanner();
            setHelperLookup(code.data);
            // Lookup nach kurzem Tick damit State gesetzt ist
            setTimeout(() => {
              const found = players.find((p) => p.nick.toLowerCase() === code.data.toLowerCase());
              if (found) {
                setHelperPlayer(found);
                setHelperError("");
              } else {
                setHelperError(`Spieler "${code.data}" nicht gefunden`);
              }
            }, 50);
            return;
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }, 200);
    } catch {
      stopScanner();
      alert("Kamera konnte nicht gestartet werden. Bitte Kamerazugriff erlauben.");
    }
  }, [players, stopScanner]);

  const loadData = async () => {
    try {
      const [playersRes, leaderboardRes, regStatusRes, teamScoresRes, scoringStatusRes, eventStartRes] = await Promise.all([
        fetch("/api/players"),
        fetch("/api/leaderboard"),
        fetch("/api/registration-status"),
        fetch("/api/team-scores"),
        fetch("/api/scoring-status"),
        fetch("/api/event-start"),
      ]);
      const playersData = await playersRes.json();
      const leaderboardData = await leaderboardRes.json();
      const regStatus = await regStatusRes.json();
      const teamScoresData = await teamScoresRes.json();
      const scoringStatus = await scoringStatusRes.json();
      const eventStartData = await eventStartRes.json();
      setRegistrationOpen(regStatus.open);
      setScoringOpen(scoringStatus.open);
      setEventStart(eventStartData.eventStart || "");
      setAdminEventStart((prev) => prev || eventStartData.eventStart || "");
      setTeamScores(teamScoresData);

      setPlayers(playersData);
      setLeaderboard(leaderboardData);
      setDataLoaded(true);

      // Scores-Objekt für rückwärtskompatible Zugriffe: scores[playerId][stationId]
      const scoresObj = {};
      leaderboardData.forEach((p) => { scoresObj[p.id] = p.scores || {}; });
      setScores(scoresObj);
    } catch (e) {
      console.error("Fehler beim Laden:", e);
    }
  };

  // Daten beim Start laden + alle 10 Sekunden aktualisieren
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const totalScore = (playerId) => {
    const s = scores[playerId] || {};
    return Object.values(s).reduce((a, b) => a + (parseInt(b) || 0), 0);
  };

  const deleteCurrentPlayer = async (nick) => {
    try {
      await fetch("/api/player/self", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gamertag: nick }),
      });
    } catch (_) {}
  };

  const registerPlayer = async () => {
    if (!regNick.trim() || !regName.trim()) { setRegError("Bitte alle Felder ausfüllen."); return; }

    if (registeredAs) await deleteCurrentPlayer(registeredAs);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gamertag: regNick.trim(), realname: regName.trim(), team: regTeam }),
    });

    if (!res.ok) {
      const err = await res.json();
      setRegError(err.error || "Fehler bei der Registrierung.");
      return;
    }

    const newPlayer = await res.json();
    await loadData();
    saveRegistration(newPlayer.nick);
    setRegisteredAs(newPlayer.nick);
    setRegistrationSuccess(newPlayer);
    setRegNick(""); setRegName(""); setRegError("");
    setView("registerSuccess");
  };

  const saveAdminScore = async (stationId) => {
    if (!adminSelectedPlayer) return;
    const val = parseInt(adminScoreInputs[stationId]);
    if (isNaN(val) || val < 0) return;

    const player = players.find((p) => String(p.id) === adminSelectedPlayer);
    if (!player) return;

    await fetch("/api/admin/score", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ADMIN_PASSWORD}`,
      },
      body: JSON.stringify({ gamertag: player.nick, station: stationId, score: val }),
    });

    await loadData();
    setAdminScoreSaved((prev) => ({ ...prev, [stationId]: true }));
    setTimeout(() => setAdminScoreSaved((prev) => ({ ...prev, [stationId]: false })), 2000);
  };

  const deletePlayer = async (playerId) => {
    if (!confirm("Spieler wirklich löschen? Alle Scores werden ebenfalls gelöscht.")) return;
    await fetch(`/api/admin/player/${playerId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${ADMIN_PASSWORD}` },
    });
    if (String(playerId) === adminSelectedPlayer) {
      setAdminSelectedPlayer("");
      setAdminScoreInputs({});
    }
    await loadData();
  };

  const helferLogin = () => {
    if (helperPw === HELPER_PASSWORD) { setHelperLoginError(""); setView("spielhelfer"); }
    else { setHelperLoginError("Falsches Passwort!"); }
  };

  const adminLogin = () => {
    if (adminPw === ADMIN_PASSWORD) { setAdminUnlocked(true); setAdminError(""); setView("admin"); }
    else { setAdminError("Falsches Passwort!"); }
  };

  const helperLookupPlayer = () => {
    const found = players.find((p) => p.nick.toLowerCase() === helperLookup.trim().toLowerCase());
    if (!found) { setHelperError("Gamertag nicht gefunden."); setHelperPlayer(null); return; }
    setHelperPlayer(found);
    setHelperError("");
    // Vorhandenen Score der Station vorausfüllen
    const existing = (scores[found.id] || {})[helperStation?.id];
    setHelperScore(existing !== undefined ? String(existing) : "");
    setHelperSuccess(false);
  };

  const helperSubmit = async () => {
    if (!helperStation || !helperPlayer) return;
    const val = parseInt(helperScore);
    if (isNaN(val) || val < 0) return;

    await fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gamertag: helperPlayer.nick, station: helperStation.id, score: val }),
    });

    await loadData();
    setHelperSuccess(true);
    // Nach 2 Sekunden alles zurücksetzen inkl. Station (Helfer wechselt ggf.)
    setTimeout(() => {
      setHelperStation(null);
      setHelperLookup("");
      setHelperPlayer(null);
      setHelperScore("");
      setHelperSuccess(false);
    }, 2000);
  };

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
      display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 28,
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

  // ── COUNTDOWN ────────────────────────────────────────────────────────────────

  const Countdown = () => {
    const [tick, setTick] = useState(0);
    useEffect(() => {
      const id = setInterval(() => setTick((n) => n + 1), 1000);
      return () => clearInterval(id);
    }, []);
    if (!eventStart) return null;
    const diff = new Date(eventStart) - Date.now();
    if (diff <= 0) return (
      <div style={{ margin: "24px 0 8px", fontSize: 22, fontWeight: 900, color: "#00FF41", letterSpacing: 4, textShadow: "0 0 20px #00FF41" }}>
        🎮 EVENT LÄUFT!
      </div>
    );
    const totalSec = Math.floor(diff / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n) => String(n).padStart(2, "0");
    const units = d > 0
      ? [["TAGE", d], ["STD", h], ["MIN", m], ["SEK", s]]
      : [["STD", h], ["MIN", m], ["SEK", s]];
    return (
      <div style={{ margin: "28px auto 4px", display: "inline-flex", alignItems: "center", gap: 0 }}>
        {units.flatMap(([label, val], i) => {
          const block = (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, fontWeight: 900, color: "#00FF41", textShadow: "0 0 24px #00FF41, 0 0 60px #00FF4144", lineHeight: 1, fontVariantNumeric: "tabular-nums", minWidth: 60 }}>{pad(val)}</div>
              <div style={{ fontSize: 9, letterSpacing: 3, color: "#555", marginTop: 4 }}>{label}</div>
            </div>
          );
          if (i === 0) return [block];
          return [
            <div key={`sep-${i}`} style={{ fontSize: 36, fontWeight: 900, color: "#00FF4166", padding: "0 4px", marginBottom: 18 }}>:</div>,
            block,
          ];
        })}
      </div>
    );
  };

  // ── MODALS ───────────────────────────────────────────────────────────────────

  const QrDisplayModal = () => !qrModal ? null : (
    <div onClick={() => setQrModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 18, padding: "32px 28px", textAlign: "center", maxWidth: 300, width: "90%" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: "#888", marginBottom: 16 }}>DEIN QR-CODE</div>
        {qrDataUrl
          ? <img src={qrDataUrl} alt="QR Code" style={{ borderRadius: 8, display: "block", margin: "0 auto" }} />
          : <div style={{ width: 220, height: 220, margin: "0 auto", background: "rgba(255,255,255,0.05)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#444" }}>Lädt…</div>
        }
        <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", marginTop: 16, letterSpacing: 2 }}>{qrModal}</div>
        <div style={{ fontSize: 11, color: "#555", marginTop: 6, marginBottom: 20 }}>Zeige diesen Code dem Spielhelfer</div>
        <button style={{ ...s.btn("#555"), width: "100%" }} onClick={() => setQrModal(null)}>✕ Schließen</button>
      </div>
    </div>
  );

  const QrScannerModal = () => !scannerOpen ? null : (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 18, padding: "24px", textAlign: "center", maxWidth: 340, width: "90%" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: "#888", marginBottom: 16 }}>QR-CODE SCANNEN</div>
        <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "#000", aspectRatio: "1" }}>
          <video ref={videoRef} style={{ width: "100%", display: "block" }} playsInline muted />
          <canvas ref={canvasRef} style={{ display: "none" }} />
          <div style={{ position: "absolute", inset: "20%", border: "2px solid #00FF41", borderRadius: 8, pointerEvents: "none" }} />
        </div>
        <div style={{ fontSize: 12, color: "#555", marginTop: 14, marginBottom: 20 }}>Halte den QR-Code des Spielers in den Rahmen</div>
        <button style={{ ...s.btn("#555"), width: "100%" }} onClick={stopScanner}>✕ Abbrechen</button>
      </div>
    </div>
  );

  // ── VIEWS ────────────────────────────────────────────────────────────────────

  const NavBar = () => (
    <div style={s.navBar}>
      <button style={s.btn(view === "home" ? "#00FF41" : "#444", view !== "home")} onClick={() => setView("home")}>🏠 Home</button>
      <button style={s.btn(view === "register" ? "#00D4FF" : "#444", view !== "register")} onClick={() => setView("register")}>➕ Registrieren</button>
      <button style={s.btn(view === "leaderboard" ? "#FFD700" : "#444", view !== "leaderboard")} onClick={() => setView("leaderboard")}>🏆 Leaderboard</button>
    </div>
  );

  if (view === "home") return (
    <div style={s.app}>
      <div style={s.bg} />
      <div style={crtStyle} />
      <QrDisplayModal />
      <div style={s.wrap}>
        <NavBar />
        {(() => {
          const me = (registeredAs && dataLoaded)
            ? leaderboard.find((p) => p.nick.toLowerCase() === registeredAs.toLowerCase())
            : null;
          // Zeige Lade-Spinner wenn registriert aber Daten noch unterwegs
          const isLoadingMe = registeredAs && !dataLoaded;
          const myRank = me ? leaderboard.indexOf(me) : -1;
          const myStationsDone = me ? me.stationCount : 0;
          const myStationsLeft = 12 - myStationsDone;

          return (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 60, marginBottom: 8 }}>🕹️</div>
              <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: 6, color: "#00FF41", textShadow: "0 0 30px #00FF41, 0 0 80px #00FF4144" }}>ARCADE EVENT</div>
              <div style={{ fontSize: 11, letterSpacing: 10, color: "#555", margin: "8px 0 4px" }}>OLDENBURGER COMPUTER MUSEUM</div>
              <div style={{ fontSize: 11, letterSpacing: 6, color: "#333" }}>SPARTE7 E-SPORTS EVENT</div>

              <Countdown />

              {/* Kurzer Lade-Indikator während Daten vom Server kommen */}
              {isLoadingMe && (
                <div style={{ marginTop: 36, fontSize: 12, letterSpacing: 3, color: "#444" }}>
                  ▌ LADE DATEN...
                </div>
              )}

              {/* Persönliche Karte wenn registriert */}
              {me ? (() => {
                const myTeam = TEAMS[me.team];
                return (
                <div style={{ maxWidth: 500, margin: "36px auto 0", padding: "24px 28px", background: myTeam ? myTeam.bg : "rgba(0,255,65,0.06)", border: `1px solid ${myTeam ? myTeam.color + "44" : "#00FF4133"}`, borderRadius: 14, boxShadow: `0 0 30px ${myTeam ? myTeam.color + "22" : "#00FF4120"}`, textAlign: "left" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ fontSize: 11, letterSpacing: 3, color: myTeam?.color || "#00FF41" }}>DEINE SPIELERKARTE</div>
                    {myTeam && <TeamBadge team={me.team} />}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: myTeam?.color || "#00FF41" }}>{me.nick}</div>
                      <div style={{ fontSize: 12, color: "#555" }}>{me.name}</div>
                    </div>
                    <div style={{ fontSize: 36, fontWeight: 900 }}>
                      {RANKS[myRank] || `#${myRank + 1}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 900, color: "#FFD700", textShadow: "0 0 12px #FFD700" }}>{me.total.toLocaleString()}</div>
                      <div style={{ fontSize: 10, letterSpacing: 2, color: "#666" }}>PUNKTE</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 900, color: "#00D4FF" }}>{myStationsDone}<span style={{ fontSize: 14, color: "#555" }}>/12</span></div>
                      <div style={{ fontSize: 10, letterSpacing: 2, color: "#666" }}>STATIONEN</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 900, color: myStationsLeft === 0 ? "#00FF41" : "#FF8C00" }}>{myStationsLeft}</div>
                      <div style={{ fontSize: 10, letterSpacing: 2, color: "#666" }}>AUSSTEHEND</div>
                    </div>
                  </div>
                  {/* Stationen-Fortschritt */}
                  <div style={{ display: "flex", gap: 4, marginTop: 16, flexWrap: "wrap" }}>
                    {STATIONS.map((st) => {
                      const done = (scores[me.id] || {})[st.id] !== undefined;
                      return (
                        <div key={st.id} title={st.name} style={{ flex: "0 0 auto", padding: "3px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: done ? st.color : "rgba(255,255,255,0.05)", color: done ? "#000" : "#444", border: `1px solid ${done ? st.color : "rgba(255,255,255,0.08)"}` }}>
                          {st.id}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    style={{ marginTop: 16, width: "100%", padding: "10px", background: "rgba(255,255,255,0.05)", border: `1px solid ${myTeam?.color || "#00FF41"}44`, borderRadius: 8, color: myTeam?.color || "#00FF41", fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: "pointer" }}
                    onClick={() => setQrModal(me.nick)}
                  >
                    📱 QR-CODE FÜR SPIELHELFER
                  </button>
                </div>
                );
              })() : (
                <div style={{ display: "flex", justifyContent: "center", gap: 32, margin: "48px 0" }}>
                  {[["👾", players.length, "Spieler"], ["🎮", "12", "Retrospiele"], ["🏆", leaderboard[0]?.nick || "—", "Führend"]].map(([icon, val, label]) => (
                    <div key={label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 28 }}>{icon}</div>
                      <div style={{ fontSize: 26, fontWeight: 900, color: "#00FF41", textShadow: "0 0 12px #00FF41" }}>{val}</div>
                      <div style={{ fontSize: 10, letterSpacing: 3, color: "#666" }}>{label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: me ? 24 : 0 }}>
                {!me && <button style={s.btn("#00FF41")} onClick={() => setView("register")}>🎮 Jetzt registrieren</button>}
                <button style={s.btn("#FFD700", true)} onClick={() => setView("leaderboard")}>🏆 Rangliste ansehen</button>
              </div>

              {!me && (
                <div style={{ marginTop: 48, padding: "20px 24px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", maxWidth: 480, margin: "48px auto 0" }}>
                  <div style={{ fontSize: 11, letterSpacing: 3, color: "#888", marginBottom: 12 }}>SO FUNKTIONIERT'S</div>
                  {["1. Registriere dich mit deinem Gamertag", "2. Spiele eine der 12 Retrospiele", "3. Melde deinen Score sofort beim Stationshelfer", "4. Spiele so viele Spiele wie möglich", "5. Wer die meisten Punkte sammeln kann, gewinnt die Ähre!"].map((t) => (
                    <div key={t} style={{ fontSize: 13, color: "#aaa", marginBottom: 6, textAlign: "left" }}>▶ {t}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
        <Footer />
      </div>
    </div>
  );

  if (view === "registerSuccess") return (
    <div style={{ ...s.app, overflow: "hidden" }}>
      <div style={s.bg} />
      <div style={crtStyle} />

      {/* Konfetti-Partikel */}
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes successPop {
          0%   { transform: scale(0.7); opacity: 0; }
          60%  { transform: scale(1.08); }
          100% { transform: scale(1);   opacity: 1; }
        }
        .confetti-piece {
          position: fixed;
          top: -10px;
          width: 10px;
          height: 14px;
          opacity: 0;
          animation: confettiFall linear forwards;
        }
      `}</style>

      {(() => {
        const team = TEAMS[registrationSuccess?.team] || TEAMS.blau;
        const confettiColors = [team.color, "#ffffff", team.color, "#ffffff88", team.color];
        return (
          <>
            {[...Array(50)].map((_, i) => (
              <div key={i} className="confetti-piece" style={{
                left: `${Math.random() * 100}%`,
                background: confettiColors[i % confettiColors.length],
                width: `${6 + Math.random() * 8}px`,
                height: `${8 + Math.random() * 10}px`,
                borderRadius: Math.random() > 0.5 ? "50%" : "2px",
                animationDuration: `${1.5 + Math.random() * 2.5}s`,
                animationDelay: `${Math.random() * 1.4}s`,
              }} />
            ))}

            <div style={{ ...s.wrap, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
              <div style={{ textAlign: "center", animation: "successPop 0.5s ease forwards" }}>
                <div style={{ fontSize: 72, marginBottom: 16 }}>🎮</div>
                <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 5, color: team.color, textShadow: `0 0 30px ${team.color}, 0 0 80px ${team.color}44`, marginBottom: 8 }}>
                  BEREIT!
                </div>
                <div style={{ fontSize: 16, letterSpacing: 3, color: "#aaa", marginBottom: 4 }}>
                  Du kannst jetzt losspielen,
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#FFD700", letterSpacing: 2, textShadow: "0 0 12px #FFD700", marginBottom: 20 }}>
                  {registrationSuccess?.nick}!
                </div>
                {/* Team-Anzeige */}
                <div style={{ display: "inline-block", padding: "10px 28px", borderRadius: 30, marginBottom: 28, background: team.bg, border: `2px solid ${team.color}`, boxShadow: `0 0 24px ${team.color}44` }}>
                  <div style={{ fontSize: 11, color: team.color, letterSpacing: 3, marginBottom: 2 }}>DEIN TEAM</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: team.color, letterSpacing: 3 }}>{team.label.toUpperCase()}</div>
                </div>
                <div style={{ fontSize: 12, color: "#555", letterSpacing: 2, marginBottom: 32 }}>
                  SUCHE DIR DEIN ERSTES SPIEL AUS UND LET'S GO!
                </div>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  <button style={s.btn(team.color)} onClick={() => setView("home")}>🃏 Zu deiner Karte</button>
                  <button style={s.btn("#FFD700", true)} onClick={() => setView("leaderboard")}>🏆 Zur Rangliste</button>
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );

  if (view === "register") return (
    <div style={s.app}>
      <div style={s.bg} />
      <div style={crtStyle} />
      <div style={s.wrap}>
        <NavBar />
        <div style={s.h2}>➕ Spieler Registrierung</div>

        {/* Hinweis wenn Registrierung geschlossen */}
        {!registrationOpen && (
          <div style={{ ...s.card, border: "1px solid #FF444444", background: "rgba(255,68,68,0.05)", marginBottom: 20 }}>
            <div style={{ fontSize: 14, color: "#FF4444", fontWeight: 700 }}>🚫 Registrierungen aktuell nicht möglich</div>
            <div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>Bitte wende dich an die Spielleitung</div>
          </div>
        )}

        {/* Hinweis wenn bereits registriert */}
        {registeredAs && (
          <div style={{ ...s.card, border: "1px solid #FFD70044", background: "rgba(255,215,0,0.05)", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 13, color: "#FFD700" }}>
                  ⚠ Du bist auf diesem Gerät bereits als <strong>{registeredAs}</strong> registriert.
                </div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>
                  Du kannst dich trotzdem mit einem neuen Gamertag registrieren — damit verlierst du dein aktuelles Konto und alle erspielten Punkte!
                </div>
              </div>
              <button
                style={{ ...s.btn("#FF4444", true), padding: "5px 12px", fontSize: 11, whiteSpace: "nowrap" }}
                onClick={async () => { if (confirm(`Wirklich abmelden? Dein Gamertag "${registeredAs}" und alle erspielten Punkte werden unwiderruflich gelöscht.`)) { await deleteCurrentPlayer(registeredAs); localStorage.removeItem("retro_gamertag"); setRegisteredAs(null); await loadData(); } }}
              >✕ Abmelden</button>
            </div>
          </div>
        )}

        <div style={s.card}>
          <div style={{ marginBottom: 18 }}>
            <label style={s.label}>Gamertag / Nickname</label>
            <input style={s.input} value={regNick} onChange={(e) => setRegNick(e.target.value)} placeholder="z.B. PixelHero99" onKeyDown={(e) => e.key === "Enter" && registerPlayer()} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={s.label}>Dein Vorname</label>
            <input style={s.input} value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="z.B. Max" onKeyDown={(e) => e.key === "Enter" && registerPlayer()} />
          </div>
          {/* Teamwahl */}
          <div style={{ marginBottom: 24 }}>
            <label style={s.label}>Team wählen <span style={{ color: "#444", fontWeight: 400 }}>(optional – sonst zufällig)</span></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {Object.entries(TEAMS).map(([key, t]) => {
                const selected = regTeam === key;
                return (
                  <div key={key} onClick={() => setRegTeam(selected ? null : key)} style={{
                    padding: "12px 16px", borderRadius: 8, cursor: "pointer", textAlign: "center",
                    background: selected ? t.bg : "rgba(255,255,255,0.03)",
                    border: `2px solid ${selected ? t.color : "rgba(255,255,255,0.08)"}`,
                    boxShadow: selected ? `0 0 16px ${t.color}44` : "none",
                    transition: "all 0.15s",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: selected ? t.color : "#555", letterSpacing: 2 }}>{t.label}</div>
                    {selected && <div style={{ fontSize: 10, color: t.color, marginTop: 3, letterSpacing: 1 }}>✓ Deine Wahl</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {regError && <div style={{ color: "#FF4444", fontSize: 13, marginBottom: 16 }}>⚠ {regError}</div>}
          <button style={{ ...s.btn("#00FF41"), opacity: registrationOpen ? 1 : 0.3, cursor: registrationOpen ? "pointer" : "not-allowed" }} onClick={registrationOpen ? registerPlayer : undefined}>🎮 Registrieren & Starten</button>
          <div style={{ fontSize: 11, color: "#444", marginTop: 16, lineHeight: 1.6 }}>
            🔒 Alle Daten werden sorgfältig behandelt, werden nach der Veranstaltung umgehend gelöscht und dienen ausschließlich zum Zuordnen der Punktestände.<br />
            Bitte beachte, dass dein Vorname für unsere Spielleitung sichtbar ist, um eine korrekte Zuordnung sicherstellen zu können.
          </div>
        </div>

        {players.length > 0 && (
          <div style={s.card}>
            <div style={s.h3}>Bereits registriert ({players.length})</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {players.map((p) => (
                <div key={p.id} style={{ background: "rgba(0,255,65,0.08)", border: "1px solid rgba(0,255,65,0.2)", borderRadius: 6, padding: "6px 12px", fontSize: 13 }}>
                  <span style={{ color: "#00FF41" }}>{p.nick}</span> <span style={{ color: "#555", fontSize: 11 }}>{p.registeredAt}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <Footer />
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

        {/* Tab-Umschalter */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[["spieler", "👾 Spieler"], ["teams", "🛡️ Teams"]].map(([tab, label]) => (
            <button key={tab} style={s.btn(leaderboardTab === tab ? "#FFD700" : "#444", leaderboardTab !== tab)} onClick={() => setLeaderboardTab(tab)}>{label}</button>
          ))}
        </div>

        {leaderboardTab === "spieler" ? (
          leaderboard.length === 0 ? (
            <div style={{ ...s.card, textAlign: "center", color: "#555", padding: 48 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>👾</div>
              Bisher noch keine Spieler registriert.
            </div>
          ) : leaderboard.map((p, i) => (
            <div key={p.id} style={s.leaderRow(i)}>
              <div style={{ fontSize: 24, minWidth: 32 }}>{RANKS[i] || `${i + 1}.`}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 900, fontSize: 15, color: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#e0e0e0" }}>{p.nick}</span>
                  <TeamBadge team={p.team} />
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 900, fontSize: 20, color: i < 3 ? "#FFD700" : "#e0e0e0", textShadow: i === 0 ? "0 0 12px #FFD700" : "none" }}>{p.total.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: 2 }}>PTS</div>
              </div>
              <div style={{ display: "flex", gap: 3 }}>
                {STATIONS.map((st) => {
                  const hasScore = (scores[p.id] || {})[st.id] !== undefined;
                  return <div key={st.id} style={{ width: 6, height: 6, borderRadius: 2, background: hasScore ? st.color : "rgba(255,255,255,0.1)" }} title={st.name} />;
                })}
              </div>
            </div>
          ))
        ) : (
          // Team-Rangliste
          (() => {
            const sorted = [...Object.entries(TEAMS)].map(([key, t]) => {
              const ts = teamScores.find(x => x.team === key);
              return { key, ...t, total: ts?.total || 0, members: ts?.members || 0 };
            }).sort((a, b) => b.total - a.total);
            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
                {sorted.map((t, i) => (
                  <div key={t.key} style={{ ...s.card, background: t.bg, border: `2px solid ${t.color}55`, boxShadow: `0 0 20px ${t.color}22`, textAlign: "center", padding: "24px 16px" }}>
                    <div style={{ fontSize: 28, marginBottom: 4 }}>{RANKS[i] || `${i + 1}.`}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: t.color, letterSpacing: 3, marginBottom: 8 }}>{t.label.toUpperCase()}</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: t.color, textShadow: `0 0 12px ${t.color}` }}>{t.total.toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: "#555", letterSpacing: 2, marginBottom: 8 }}>PUNKTE</div>
                    <div style={{ fontSize: 11, color: "#666" }}>{t.members} Spieler</div>
                  </div>
                ))}
              </div>
            );
          })()
        )}

        {leaderboardTab === "spieler" && leaderboard.length > 0 && (
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "#444", letterSpacing: 2 }}>
            {leaderboard.length} SPIELER · {STATIONS.length} STATIONEN
          </div>
        )}
        <Footer />
      </div>
    </div>
  );

  if (view === "helferLogin") return (
    <div style={s.app}>
      <div style={s.bg} />
      <div style={crtStyle} />
      <div style={s.wrap}>
        <div style={{ maxWidth: 360, margin: "60px auto" }}>
          <div style={s.h2}>🧑‍🔧 Spielhelfer Login</div>
          <div style={s.card}>
            <label style={s.label}>Passwort</label>
            <input style={{ ...s.input, marginBottom: 16 }} type="password" value={helperPw} onChange={(e) => setHelperPw(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && helferLogin()} />
            {helperLoginError && <div style={{ color: "#FF4444", fontSize: 13, marginBottom: 14 }}>⚠ {helperLoginError}</div>}
            <button style={s.btn("#00FF41")} onClick={helferLogin}>Einloggen</button>
          </div>
        </div>
        <Footer />
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
            <input style={{ ...s.input, marginBottom: 16 }} type="password" value={adminPw} onChange={(e) => setAdminPw(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && adminLogin()} />
            {adminError && <div style={{ color: "#FF4444", fontSize: 13, marginBottom: 14 }}>⚠ {adminError}</div>}
            <button style={s.btn("#FF6B35")} onClick={adminLogin}>Einloggen</button>
          </div>
        </div>
        <Footer />
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

        {/* Event-Start Countdown */}
        <div style={{ ...s.card, marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#FFD700", marginBottom: 4 }}>⏱ Event-Start (Countdown)</div>
          <div style={{ fontSize: 11, color: "#555", marginBottom: 12 }}>{eventStart ? `Aktuell: ${new Date(eventStart).toLocaleString("de-DE")}` : "Kein Datum gesetzt — kein Countdown sichtbar"}</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="datetime-local"
              value={adminEventStart}
              onChange={(e) => setAdminEventStart(e.target.value)}
              style={{ ...s.input, flex: 1, minWidth: 200, colorScheme: "dark" }}
            />
            <button
              style={s.btn("#FFD700")}
              onClick={async () => {
                const res = await fetch("/api/admin/event-start", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${ADMIN_PASSWORD}` },
                  body: JSON.stringify({ value: adminEventStart }),
                });
                const data = await res.json();
                setEventStart(data.eventStart || "");
              }}
            >💾 Speichern</button>
            {eventStart && <button style={s.btn("#444")} onClick={async () => {
              const res = await fetch("/api/admin/event-start", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${ADMIN_PASSWORD}` },
                body: JSON.stringify({ value: "" }),
              });
              const data = await res.json();
              setEventStart(data.eventStart || "");
              setAdminEventStart("");
            }}>✕ Löschen</button>}
          </div>
        </div>

        {/* Registrierungs-Switch */}
        <div style={{ ...s.card, marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: registrationOpen ? "#00FF41" : "#FF4444" }}>
              {registrationOpen ? "✅ Registrierung geöffnet" : "🚫 Registrierung geschlossen"}
            </div>
            <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>Neue Spieler können sich {registrationOpen ? "aktuell" : "nicht"} registrieren.</div>
          </div>
          <div
            onClick={async () => {
              const res = await fetch("/api/admin/registration-status", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${ADMIN_PASSWORD}` },
                body: JSON.stringify({ open: !registrationOpen }),
              });
              const data = await res.json();
              setRegistrationOpen(data.open);
            }}
            style={{
              width: 56, height: 28, borderRadius: 14, cursor: "pointer",
              background: registrationOpen ? "#00FF41" : "#333",
              border: `2px solid ${registrationOpen ? "#00FF41" : "#555"}`,
              position: "relative", transition: "all 0.2s",
              boxShadow: registrationOpen ? "0 0 12px #00FF4166" : "none",
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: "50%", background: "#fff",
              position: "absolute", top: 2,
              left: registrationOpen ? 30 : 2,
              transition: "left 0.2s",
            }} />
          </div>
        </div>

        {/* Scoring-Switch */}
        <div style={{ ...s.card, marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: scoringOpen ? "#00FF41" : "#FF4444" }}>
              {scoringOpen ? "✅ Scoring aktiv" : "⏸ Scoring pausiert"}
            </div>
            <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>Spielhelfer können Scores {scoringOpen ? "aktuell" : "nicht"} eintragen.</div>
          </div>
          <div
            onClick={async () => {
              const res = await fetch("/api/admin/scoring-status", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${ADMIN_PASSWORD}` },
                body: JSON.stringify({ open: !scoringOpen }),
              });
              const data = await res.json();
              setScoringOpen(data.open);
            }}
            style={{
              width: 56, height: 28, borderRadius: 14, cursor: "pointer",
              background: scoringOpen ? "#00FF41" : "#333",
              border: `2px solid ${scoringOpen ? "#00FF41" : "#555"}`,
              position: "relative", transition: "all 0.2s",
              boxShadow: scoringOpen ? "0 0 12px #00FF4166" : "none",
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: "50%", background: "#fff",
              position: "absolute", top: 2,
              left: scoringOpen ? 30 : 2,
              transition: "left 0.2s",
            }} />
          </div>
        </div>

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
            onChange={(e) => {
              setAdminSelectedPlayer(e.target.value);
              setAdminScoreInputs(Object.fromEntries(Object.entries(scores[e.target.value] || {}).map(([k, v]) => [k, v])));
              setAdminScoreSaved({});
            }}
          >
            <option value="">— Spieler auswählen —</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.nick} ({p.name}) [{TEAMS[p.team]?.label || p.team}]</option>)}
          </select>

          {adminSelectedPlayer && (
            <div style={s.stationGrid}>
              {STATIONS.map((st) => {
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
                        onChange={(e) => setAdminScoreInputs((prev) => ({ ...prev, [st.id]: e.target.value }))}
                        placeholder="Score..."
                        onKeyDown={(e) => e.key === "Enter" && saveAdminScore(st.id)}
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
                  <th style={{ textAlign: "left", padding: "8px 10px", color: "#888", fontSize: 11, letterSpacing: 2, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>TEAM</th>
                  <th style={{ textAlign: "right", padding: "8px 10px", color: "#888", fontSize: 11, letterSpacing: 2, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>STATIONEN</th>
                  <th style={{ textAlign: "right", padding: "8px 10px", color: "#FFD700", fontSize: 11, letterSpacing: 2, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>GESAMT</th>
                  <th style={{ textAlign: "right", padding: "8px 10px", color: "#888", fontSize: 11, letterSpacing: 2, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>AKTION</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "8px 10px", color: "#00FF41", fontWeight: 700 }}>{RANKS[i] || `${i + 1}.`} {p.nick}</td>
                    <td style={{ padding: "8px 10px", color: "#aaa" }}>{p.name}</td>
                    <td style={{ padding: "8px 10px" }}><TeamBadge team={p.team} /></td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#888" }}>{p.stationCount}/12</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#FFD700", fontWeight: 900 }}>{p.total.toLocaleString()}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>
                      <button
                        style={{ ...s.btn("#FF4444", true), padding: "4px 10px", fontSize: 11 }}
                        onClick={() => deletePlayer(p.id)}
                      >🗑 Löschen</button>
                    </td>
                  </tr>
                ))}
                {players.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "#444" }}>Noch keine Spieler</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );

  if (view === "spielhelfer") return (
    <div style={s.app}>
      <div style={s.bg} />
      <div style={crtStyle} />
      <QrScannerModal />
      <div style={s.wrap}>
        <div style={s.h2}>🧑‍🔧 Spielhelfer – Score eintragen</div>

        {/* Scoring pausiert Banner */}
        {!scoringOpen && (
          <div style={{ ...s.card, border: "1px solid #FF4444", background: "rgba(255,68,68,0.08)", textAlign: "center", padding: "20px 24px", marginBottom: 8 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⏸</div>
            <div style={{ fontWeight: 900, color: "#FF4444", letterSpacing: 2, marginBottom: 6 }}>SCORING PAUSIERT</div>
            <div style={{ fontSize: 13, color: "#888" }}>Das Eintragen von Scores ist aktuell deaktiviert.<br/>Bitte warte auf Freigabe durch den Admin.</div>
          </div>
        )}

        {/* Erfolgs-Feedback */}
        {helperSuccess && (
          <div style={{ ...s.card, textAlign: "center", border: "1px solid #00FF41", boxShadow: "0 0 30px #00FF4133", padding: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 20, color: "#00FF41", fontWeight: 900, letterSpacing: 3 }}>SCORE GESPEICHERT!</div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 8, letterSpacing: 2 }}>Bitte Station neu auswählen...</div>
          </div>
        )}

        {/* Schritt 1: Station auswählen */}
        {!helperSuccess && (
          <div style={s.card}>
            <div style={s.h3}>Schritt 1 — Station auswählen</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
              {STATIONS.map((st) => {
                const selected = helperStation?.id === st.id;
                return (
                  <button
                    key={st.id}
                    style={{
                      background: selected ? st.color : "rgba(255,255,255,0.03)",
                      color: selected ? "#000" : st.color,
                      border: `2px solid ${st.color}`,
                      borderRadius: 8, padding: "12px 10px",
                      fontFamily: "'Courier New', monospace",
                      fontWeight: 700, fontSize: 12, letterSpacing: 1,
                      cursor: "pointer", textAlign: "center",
                      boxShadow: selected ? `0 0 18px ${st.color}88` : "none",
                      transition: "all 0.15s",
                    }}
                    onClick={() => {
                      setHelperStation(st);
                      setHelperPlayer(null);
                      setHelperLookup("");
                      setHelperScore("");
                      setHelperError("");
                    }}
                  >
                    <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2 }}>STATION {st.id}</div>
                    {st.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Schritt 2: Spieler suchen */}
        {!helperSuccess && helperStation && (
          <div style={{ ...s.card, border: `1px solid ${helperStation.color}44` }}>
            <div style={s.h3}>
              Schritt 2 — Spieler suchen
              <span style={{ color: helperStation.color, marginLeft: 10 }}>
                Station {helperStation.id}: {helperStation.name}
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={s.label}>Gamertag des Spielers</label>
                <input
                  style={s.input}
                  value={helperLookup}
                  onChange={(e) => setHelperLookup(e.target.value)}
                  placeholder="Gamertag eingeben..."
                  onKeyDown={(e) => e.key === "Enter" && helperLookupPlayer()}
                  autoFocus
                />
              </div>
              <button style={s.btn(helperStation.color)} onClick={helperLookupPlayer}>Suchen</button>
              <button style={s.btn("#888")} onClick={startScanner}>📷 QR</button>
            </div>
            {helperError && <div style={{ color: "#FF4444", fontSize: 13, marginTop: 10 }}>⚠ {helperError}</div>}
          </div>
        )}

        {/* Schritt 3: Score eingeben & absenden */}
        {!helperSuccess && helperPlayer && helperStation && (() => {
          const existingScore = (scores[helperPlayer.id] || {})[helperStation.id];
          return (
            <div style={{ ...s.card, border: `1px solid ${helperStation.color}66`, boxShadow: `0 0 24px ${helperStation.color}22` }}>
              <div style={s.h3}>Schritt 3 — Score eingeben & absenden</div>

              {/* Spieler-Info */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, padding: "12px 16px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: helperStation.color }}>{helperPlayer.nick}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{helperPlayer.name}</div>
                </div>
                {existingScore !== undefined && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "#666", letterSpacing: 2 }}>BISHERIGER SCORE</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#aaa" }}>{existingScore.toLocaleString()}</div>
                  </div>
                )}
              </div>

              {/* Score-Eingabe */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ ...s.label, color: helperStation.color }}>Score für {helperStation.name}</label>
                <input
                  style={{ ...s.input, fontSize: 28, padding: "14px 16px", textAlign: "center", fontWeight: 900, color: helperStation.color, border: `2px solid ${helperStation.color}66` }}
                  type="number" min="0"
                  value={helperScore}
                  onChange={(e) => setHelperScore(e.target.value)}
                  placeholder="0"
                  onKeyDown={(e) => e.key === "Enter" && helperSubmit()}
                  autoFocus
                />
              </div>

              <button
                style={{ ...s.btn(helperStation.color), width: "100%", padding: "16px", fontSize: 16, letterSpacing: 3, opacity: scoringOpen ? 1 : 0.35, cursor: scoringOpen ? "pointer" : "not-allowed" }}
                onClick={scoringOpen ? helperSubmit : undefined}
                disabled={!scoringOpen}
              >
                ✅ Score absenden
              </button>
            </div>
          );
        })()}
        <Footer />
      </div>
    </div>
  );

  if (view === "table") {
    const exportCsv = () => {
      const stationHeaders = STATIONS.map((st) => `Station ${st.id} (${st.name})`);
      const headers = ["Rang", "Gamertag", "Vorname", "Team", "Gesamt", "Stationen", ...stationHeaders];
      const rows = leaderboard.map((p, i) => {
        const playerScores = scores[p.id] || {};
        const stationCols = STATIONS.map((st) => playerScores[st.id] ?? "");
        return [i + 1, p.nick, p.name, TEAMS[p.team]?.label || p.team, p.total, p.stationCount, ...stationCols];
      });
      const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
      const csv = [headers, ...rows].map((row) => row.map(escape).join(";")).join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `retro-clash-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };

    return (
      <div style={s.app}>
        <div style={s.bg} />
        <div style={crtStyle} />
        <div style={{ ...s.wrap, maxWidth: "100%", padding: "24px 32px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
            <div>
              <div style={{ ...s.h2, marginBottom: 2 }}>📋 Spielleitung — Alle Spielerdaten</div>
              <div style={{ fontSize: 11, color: "#555", letterSpacing: 2 }}>{leaderboard.length} SPIELER · AKTUALISIERT ALLE 10 SEK</div>
            </div>
            <button style={s.btn("#00FF41")} onClick={exportCsv}>⬇ CSV exportieren</button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["#", "Gamertag", "Vorname", "Team", "Gesamt", "Sta."].concat(STATIONS.map((st) => st.name)).map((h) => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, letterSpacing: 2, color: "#555", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((p, i) => {
                  const myTeam = TEAMS[p.team];
                  const playerScores = scores[p.id] || {};
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "8px 10px", color: "#555", fontWeight: 700 }}>{RANKS[i] || `#${i + 1}`}</td>
                      <td style={{ padding: "8px 10px", fontWeight: 700, color: myTeam?.color || "#00FF41" }}>{p.nick}</td>
                      <td style={{ padding: "8px 10px", color: "#888" }}>{p.name}</td>
                      <td style={{ padding: "8px 10px" }}><TeamBadge team={p.team} /></td>
                      <td style={{ padding: "8px 10px", fontWeight: 900, color: "#FFD700" }}>{p.total.toLocaleString()}</td>
                      <td style={{ padding: "8px 10px", color: "#00D4FF" }}>{p.stationCount}/12</td>
                      {STATIONS.map((st) => {
                        const sc = playerScores[st.id];
                        return (
                          <td key={st.id} style={{ padding: "8px 10px", textAlign: "right", color: sc !== undefined ? "#fff" : "#333", background: sc !== undefined ? `${st.color}11` : "transparent", fontSize: 12 }}>
                            {sc !== undefined ? sc.toLocaleString() : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {leaderboard.length === 0 && (
                  <tr><td colSpan={6 + STATIONS.length} style={{ padding: 24, textAlign: "center", color: "#444" }}>Noch keine Spieler registriert</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  return null;
}
