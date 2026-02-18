const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

/*
  ימי השבוע לפי JS:
  0 = Sunday (יום א)
  1 = Monday
  2 = Tuesday
  3 = Wednesday
  4 = Thursday
  5 = Friday (יום ו)
  6 = Saturday (שבת)
*/

function getAvailableHours(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay();

  // שבת – אין שעות
  if (day === 6) {
    return [];
  }

  // שישי – רק 12:00–13:30
  if (day === 5) {
    return ["12:00", "12:30", "13:00", "13:30"];
  }

  // א׳–ה׳ – שעות רגילות
  return [
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
    "19:00",
    "19:30"
  ];
}

/* ===== API ===== */

// קבלת שעות לפי תאריך
app.get("/api/hours", (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: "date is required" });
  }

  const hours = getAvailableHours(date);
  res.json({ hours });
});

// קביעת תור
app.post("/api/appointments", (req, res) => {
  const { date, time, name } = req.body;

  if (!date || !time || !name) {
    return res.status(400).json({ error: "missing fields" });
  }

  const allowedHours = getAvailableHours(date);

  if (!allowedHours.includes(time)) {
    return res.status(400).json({
      error: "השעה שנבחרה אינה זמינה ביום זה"
    });
  }

  // כרגע בלי DB – רק אישור
  res.json({
    success: true,
    message: `נקבע תור ל־${name} בתאריך ${date} בשעה ${time}`
  });
});

/* ===== FRONTEND ===== */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

/* ===== START ===== */

app.listen(PORT, () => {
  console.log("=== TOMORROW MAYBE SERVER RUNNING ===");
  console.log(`Listening on port ${PORT}`);
});
