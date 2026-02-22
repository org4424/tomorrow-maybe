const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// =====================
// DB
// =====================
const db = new sqlite3.Database("./appointments.db");

db.run(`
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL
)
`);

// =====================
// שעות פעילות
// =====================
const SLOT_MINUTES = 30;

function getWorkingHours(day) {
  // 0=ראשון ... 5=שישי ... 6=שבת
  if (day === 6) return null; // שבת סגור

  if (day === 5) {
    return { start: "12:00", end: "13:30" }; // שישי
  }

  return { start: "16:00", end: "20:00" }; // כל השאר
}

function generateSlots(start, end) {
  const slots = [];
  let [h, m] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  while (h < eh || (h === eh && m < em)) {
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    m += SLOT_MINUTES;
    if (m >= 60) {
      h++;
      m = 0;
    }
  }
  return slots;
}

// =====================
// API – שעות פנויות ללקוח
// =====================
app.get("/api/available", (req, res) => {
  const { date } = req.query;
  if (!date) return res.json([]);

  const day = new Date(date).getDay();
  const hours = getWorkingHours(day);
  if (!hours) return res.json([]);

  const allSlots = generateSlots(hours.start, hours.end);

  db.all(
    "SELECT time FROM appointments WHERE date = ?",
    [date],
    (err, rows) => {
      const taken = rows.map(r => r.time);
      const free = allSlots.filter(t => !taken.includes(t));
      res.json(free);
    }
  );
});

// =====================
// API – קביעת תור
// =====================
app.post("/api/book", (req, res) => {
  const { username, date, time } = req.body;

  if (!username || !date || !time) {
    return res.status(400).json({ error: "missing_fields" });
  }

  db.get(
    "SELECT id FROM appointments WHERE date = ? AND time = ?",
    [date, time],
    (err, row) => {
      if (row) {
        return res.status(409).json({ error: "slot_taken" });
      }

      db.run(
        "INSERT INTO appointments (username, date, time) VALUES (?, ?, ?)",
        [username, date, time],
        function () {
          res.json({ ok: true, id: this.lastID });
        }
      );
    }
  );
});

// =====================
// API – ביטול תור (לקוח)
// =====================
app.post("/api/cancel", (req, res) => {
  const { username, date, time } = req.body;

  db.run(
    "DELETE FROM appointments WHERE username = ? AND date = ? AND time = ?",
    [username, date, time],
    function () {
      res.json({ ok: true, deleted: this.changes });
    }
  );
});

// =====================
// API – ניהול (יובל) – כל התורים
// =====================
app.get("/api/admin/appointments", (req, res) => {
  db.all(
    "SELECT * FROM appointments ORDER BY date, time",
    (err, rows) => res.json(rows)
  );
});

// =====================
// API – ניהול – ביטול תור
// =====================
app.delete("/api/admin/appointments/:id", (req, res) => {
  db.run(
    "DELETE FROM appointments WHERE id = ?",
    [req.params.id],
    () => res.json({ ok: true })
  );
});

// =====================
// API – ניהול – שינוי יום ושעה
// =====================
app.put("/api/admin/appointments/:id", (req, res) => {
  const { date, time } = req.body;

  if (!date || !time) {
    return res.status(400).json({ error: "missing_fields" });
  }

  db.run(
    "UPDATE appointments SET date = ?, time = ? WHERE id = ?",
    [date, time, req.params.id],
    () => res.json({ ok: true })
  );
});

// =====================
// START
// =====================
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});