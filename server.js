const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

// הגדרות
const SLOT_MINUTES = 30;

// זיכרון זמני להזמנות
// מבנה: { "2026-02-20": ["16:00", "16:30"] }
const bookings = {};

// פונקציה ליצירת סלוטים (כולל שעה אחרונה)
function generateSlots(start, end) {
  const slots = [];

  let [h, m] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  while (h < eh || (h === eh && m <= em)) {
    slots.push(
      `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
    );

    m += SLOT_MINUTES;
    if (m >= 60) {
      h++;
      m = 0;
    }
  }

  return slots;
}

// קבלת שעות פנויות
app.get("/api/available", (req, res) => {
  const { date } = req.query;
  if (!date) return res.json([]);

  const day = new Date(date).getDay(); // 0=א, 5=ו, 6=ש

  let slots = [];

  // שבת – אין שעות
  if (day === 6) {
    return res.json([]);
  }

  // שישי
  if (day === 5) {
    slots = generateSlots("12:00", "13:30");
  } else {
    // א׳–ה׳
    slots = generateSlots("16:00", "20:00");
  }

  // הסרת שעות תפוסות
  const taken = bookings[date] || [];
  const available = slots.filter(t => !taken.includes(t));

  res.json(available);
});

// הזמנת תור
app.post("/api/book", (req, res) => {
  const { username, date, time } = req.body;

  if (!username || !date || !time) {
    return res.status(400).json({ message: "נתונים חסרים" });
  }

  bookings[date] = bookings[date] || [];

  if (bookings[date].includes(time)) {
    return res.status(409).json({ message: "השעה כבר תפוסה" });
  }

  bookings[date].push(time);

  res.json({
    message: `נקבע תור ל־${username} בתאריך ${date} בשעה ${time}`
  });
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// הפעלת שרת
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
