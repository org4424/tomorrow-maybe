const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const SLOT_MINUTES = 30;

// =====================
// DB
// =====================
const db = new sqlite3.Database("./appointments.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      date TEXT NOT NULL,   -- YYYY-MM-DD
      time TEXT NOT NULL,   -- HH:MM
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // למנוע 2 תורים על אותו סלוט
  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_slot
    ON appointments(date, time)
  `);
});

// =====================
// Helpers
// =====================
function isValidISODate(dateStr) {
  // YYYY-MM-DD
  return typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function isValidTime(timeStr) {
  // HH:MM
  if (typeof timeStr !== "string" || !/^\d{2}:\d{2}$/.test(timeStr)) return false;
  const [h, m] = timeStr.split(":").map(Number);
  if (h < 0 || h > 23) return false;
  if (m !== 0 && m !== 30) return false; // כי SLOT_MINUTES = 30
  return true;
}

// =====================
// שעות פעילות
// 0=ראשון ... 5=שישי ... 6=שבת
// שבת סגור
// שישי 12:00–13:30
// כל שאר הימים 16:00–20:00
// =====================
function getWorkingHours(day) {
  if (day === 6) return null; // שבת
  if (day === 5) return { start: "12:00", end: "13:30" }; // שישי
  return { start: "16:00", end: "20:00" }; // ראשון-חמישי
}

// =====================
// יצירת סלוטים (end הוא לא כולל)
// =====================
function generateSlots(start, end) {
  const slots = [];

  let [h, m] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  while (h < eh || (h === eh && m < em)) {
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    m += SLOT_MINUTES;
    if (m >= 60) {
      h += 1;
      m = 0;
    }
  }

  return slots;
}

// =====================
// Routes for pages
// =====================
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));

// =====================
// API – שעות פנויות
// GET /api/available?date=YYYY-MM-DD
// =====================
app.get("/api/available", (req, res) => {
  const { date } = req.query;

  if (!isValidISODate(date)) return res.json([]);

  const day = new Date(`${date}T00:00:00`).getDay();
  const hours = getWorkingHours(day);
  if (!hours) return res.json([]); // שבת

  const allSlots = generateSlots(hours.start, hours.end);

  db.all("SELECT time FROM appointments WHERE date = ?", [date], (err, rows) => {
    if (err) return res.status(500).json({ error: "db_error" });

    const taken = rows.map((r) => r.time);
    const free = allSlots.filter((t) => !taken.includes(t));
    res.json(free);
  });
});

// =====================
// API – קביעת תור
// POST /api/book { username, date, time }
// מחזיר { ok:true, id }
// =====================
app.post("/api/book", (req, res) => {
  const { username, date, time } = req.body || {};

  const cleanName = (username || "").trim();

  if (!cleanName || cleanName.length < 2) {
    return res.status(400).json({ error: "bad_name" });
  }
  if (!isValidISODate(date)) {
    return res.status(400).json({ error: "bad_date" });
  }
  if (!isValidTime(time)) {
    return res.status(400).json({ error: "bad_time" });
  }

  // בדיקת שעות עבודה
  const day = new Date(`${date}T00:00:00`).getDay();
  const hours = getWorkingHours(day);
  if (!hours) return res.status(400).json({ error: "closed_day" });

  const allowedSlots = generateSlots(hours.start, hours.end);
  if (!allowedSlots.includes(time)) {
    return res.status(400).json({ error: "time_not_allowed" });
  }

  db.run(
    "INSERT INTO appointments (username, date, time) VALUES (?, ?, ?)",
    [cleanName, date, time],
    function (err) {
      if (err) {
        // UNIQUE(date,time)
        if (String(err.message || "").includes("UNIQUE")) {
          return res.status(409).json({ error: "slot_taken" });
        }
        return res.status(500).json({ error: "db_error" });
      }
      res.json({ ok: true, id: this.lastID });
    }
  );
});

// =====================
// API – התור של הלקוח לפי שם
// GET /api/my?username=NAME
// =====================
app.get("/api/my", (req, res) => {
  const username = (req.query.username || "").trim();
  if (!username) return res.json([]);

  db.all(
    "SELECT id, username, date, time FROM appointments WHERE username = ? ORDER BY date, time",
    [username],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "db_error" });
      res.json(rows);
    }
  );
});

// =====================
// API – ביטול תור ללקוח
// DELETE /api/my/:id?username=NAME
// =====================
app.delete("/api/my/:id", (req, res) => {
  const { id } = req.params;
  const username = (req.query.username || "").trim();

  if (!username) return res.status(400).json({ error: "missing_name" });

  db.run(
    "DELETE FROM appointments WHERE id = ? AND username = ?",
    [id, username],
    function (err) {
      if (err) return res.status(500).json({ error: "db_error" });
      res.json({ ok: true, deleted: this.changes });
    }
  );
});

// =====================
// ADMIN – כל התורים
// GET /api/admin/appointments
// =====================
app.get("/api/admin/appointments", (req, res) => {
  db.all(
    "SELECT id, username, date, time FROM appointments ORDER BY date, time",
    (err, rows) => {
      if (err) return res.status(500).json({ error: "db_error" });
      res.json(rows);
    }
  );
});

// =====================
// ADMIN – שינוי יום ושעה לתור
// PUT /api/admin/appointments/:id { date, time }
// =====================
app.put("/api/admin/appointments/:id", (req, res) => {
  const { id } = req.params;
  const { date, time } = req.body || {};

  if (!isValidISODate(date)) return res.status(400).json({ error: "bad_date" });
  if (!isValidTime(time)) return res.status(400).json({ error: "bad_time" });

  const day = new Date(`${date}T00:00:00`).getDay();
  const hours = getWorkingHours(day);
  if (!hours) return res.status(400).json({ error: "closed_day" });

  const allowedSlots = generateSlots(hours.start, hours.end);
  if (!allowedSlots.includes(time)) {
    return res.status(400).json({ error: "time_not_allowed" });
  }

  // לא לאפשר להכניס תור למקום תפוס (למעט אם זה אותו תור עצמו)
  db.get("SELECT id FROM appointments WHERE date = ? AND time = ?", [date, time], (err, row) => {
    if (err) return res.status(500).json({ error: "db_error" });
    if (row && String(row.id) !== String(id)) {
      return res.status(409).json({ error: "slot_taken" });
    }

    db.run(
      "UPDATE appointments SET date = ?, time = ? WHERE id = ?",
      [date, time, id],
      function (err2) {
        if (err2) return res.status(500).json({ error: "db_error" });
        res.json({ ok: true, updated: this.changes });
      }
    );
  });
});

// =====================
// ADMIN – ביטול תור
// DELETE /api/admin/appointments/:id
// =====================
app.delete("/api/admin/appointments/:id", (req, res) => {
  const { id } = req.params;

  db.run("DELETE FROM appointments WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: "db_error" });
    res.json({ ok: true, deleted: this.changes });
  });
});

// =====================
// START
// =====================
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});