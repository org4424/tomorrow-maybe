const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// =====================
// הגדרות
// =====================
const SLOT_MINUTES = 30;

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
// שעות עבודה
// =====================
function getWorkingHours(day) {
  // 0=ראשון ... 5=שישי ... 6=שבת
  if (day === 6) return null; // שבת סגור

  // שישי
  if (day === 5) {
    return { start: "12:00", end: "13:30" };
  }

  // ראשון–חמישי
  return { start: "16:00", end: "20:00" };
}

// =====================
// יצירת סלוטים
// =====================
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
// זמנים פנויים
// =====================
app.get("/api/available", (req, res) => {
  const { date } = req.query;
  if (!date) return res.json([]);

  const d = new Date(date + "T00:00:00");
  const day = d.getDay();

  const hours = getWorkingHours(day);
  if (!hours) return res.json([]);

  const allSlots = generateSlots(hours.start, hours.end);

  db.all(
    "SELECT time FROM appointments WHERE date = ?",
    [date],
    (err, rows) => {
      if (err) return res.json([]);

      const taken = rows.map(r => r.time);
      const free = allSlots.filter(t => !taken.includes(t));
      res.json(free);
    }
  );
});

// =====================
// קביעת תור
// =====================
app.post("/api/book", (req, res) => {
  const { username, date, time } = req.body;

  if (!username || !date || !time) {
    return res.status(400).json({ error: "missing_data" });
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
        () => {
          res.json({ ok: true });
        }
      );
    }
  );
});

// =====================
// מסך ניהול – שליפת תורים
// =====================
app.get("/api/admin/appointments", (req, res) => {
  db.all(
    "SELECT id, username, date, time FROM appointments ORDER BY date, time",
    (err, rows) => {
      if (err) return res.json([]);
      res.json(rows);
    }
  );
});

// =====================
// מחיקת תור (ביטול)
// =====================
app.delete("/api/admin/appointments/:id", (req, res) => {
  const { id } = req.params;

  db.run(
    "DELETE FROM appointments WHERE id = ?",
    [id],
    () => res.json({ ok: true })
  );
});

// =====================
// הפעלת שרת
// =====================
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});