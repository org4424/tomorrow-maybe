const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

/**
 * יצירת סלוטים כל חצי שעה
 */
function generateSlots(start, end) {
  const slots = [];
  let [h, m] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);

  while (h < endH || (h === endH && m <= endM)) {
    slots.push(
      `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
    );
    m += 30;
    if (m === 60) {
      m = 0;
      h++;
    }
  }
  return slots;
}

/**
 * שעות לפי יום
 */
function getSlotsByDate(dateStr) {
  const day = new Date(dateStr).getDay();
  // 0 = ראשון, 5 = שישי, 6 = שבת

  if (day === 6) {
    return []; // שבת – אין שעות
  }

  if (day === 5) {
    // שישי
    return generateSlots("12:00", "13:30");
  }

  // כל שאר הימים
  return [
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
    "19:00",
    "19:30",
  ];
}

/**
 * API – שעות פנויות
 */
app.get("/api/available", (req, res) => {
  const { date } = req.query;
  if (!date) {
    return res.json([]);
  }

  const slots = getSlotsByDate(date);
  res.json(slots);
});

/**
 * API – קביעת תור (דמה)
 */
app.post("/api/book", (req, res) => {
  const { username, date, time } = req.body;

  if (!username || !date || !time) {
    return res.status(400).json({ message: "חסר מידע" });
  }

  res.json({
    message: `התור נקבע ל־${username} ב־${date} בשעה ${time}`,
  });
});

/**
 * דף ראשי
 */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
