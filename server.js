const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

// ================= נתונים =================
const SLOT_MINUTES = 30;
const bookings = {}; // { date: [times] }

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

// ================= API =================
app.get("/api/available", (req, res) => {
  const { date } = req.query;
  if (!date) return res.json([]);

  const day = new Date(date).getDay(); // 0=א, 5=ו, 6=ש
  let slots = [];

  if (day === 6) {
    return res.json([]); // שבת
  }

  if (day === 5) {
    slots = generateSlots("12:00", "13:30"); // שישי
  } else {
    slots = generateSlots("16:00", "20:00"); // א׳–ה׳
  }

  const taken = bookings[date] || [];
  res.json(slots.filter(s => !taken.includes(s)));
});

app.post("/api/book", (req, res) => {
  const { username, date, time } = req.body;
  if (!username || !date || !time) {
    return res.status(400).json({ message: "נתונים חסרים" });
  }

  bookings[date] = bookings[date] || [];
  if (bookings[date].includes(time)) {
    return res.status(409).json({ message: "השעה תפוסה" });
  }

  bookings[date].push(time);
  res.json({ message: "התור נקבע בהצלחה" });
});

// ================= אתר =================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ================= הפעלה =================
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
