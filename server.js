const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// =====================
// הגדרות קבועות
// =====================
const BARBER = "יובל";
const ALLOWED_USERS = ["אור", "אלון", "נועם", "יהודה"];
const SLOT_MINUTES = 30;
const NOTE_TEXT = "בלי נדר";

// =====================
// חיבור למסד נתונים
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
// שעות פעילות לפי יום
// =====================
function getWorkingHours(day) {
  // getDay():
  // 0 = ראשון
  // 1 = שני
  // 2 = שלישי
  // 3 = רביעי
  // 4 = חמישי
  // 5 = שישי
  // 6 = שבת

  // שבת – סגור
  if (day === 6) {
    return null;
  }

  // שישי – שעות מיוחדות
  if (day === 5) {
    return { start: "12:00", end: "13:30" };
  }

  // ראשון עד חמישי – שעות רגילות
  return { start: "16:00", end: "20:00" };
}

// =====================
// יצירת סלוטים של 30 דקות
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
// קבלת זמנים פנויים
// =====================
app.get("/api/available", (req, res) => {
  const { date } = req.query;
  if (!date) return res.json([]);

  const day = new Date(date).getDay();
  const hours = getWorkingHours(day);

  // שבת – אין שעות
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
// קביעת תור
// =====================
app.post("/api/book", (req, res) => {
  const { username, date, time } = req.body;

  if (!ALLOWED_USERS.includes(username)) {
    return res.status(403).json({ error: "user_not_allowed" });
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
          res.json({
            ok: true,
            message: `נקבע תור ל־${username} ב־${time} ${NOTE_TEXT}`
          });
        }
      );
    }
  );
});

// =====================
// מסך ניהול – יובל
// =====================
app.get("/api/admin/appointments", (req, res) => {
  db.all(
    "SELECT id, username, date, time FROM appointments ORDER BY date, time",
    (err, rows) => {
      res.json(
        rows.map(r => ({
          ...r,
          note: NOTE_TEXT
        }))
      );
    }
  );
});

app.delete("/api/admin/appointments/:id", (req, res) => {
  const { id } = req.params;

  db.run(
    "DELETE FROM appointments WHERE id = ?",
    [id],
    () => {
      res.json({ ok: true });
    }
  );
});

// =====================
// הפעלת השרת
// =====================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
