const express = require("express")
const path = require("path")
const sqlite3 = require("sqlite3").verbose()

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(express.static("public"))

/* ======================
   DATABASE
====================== */
const db = new sqlite3.Database("./appointments.db")

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      date TEXT,
      time TEXT,
      status TEXT
    )
  `)
})

/* ======================
   HELPERS
====================== */

function getDayOfWeek(dateStr) {
  // 0=Sunday ... 6=Saturday
  return new Date(dateStr).getDay()
}

function getAvailableTimes(dateStr) {
  const day = getDayOfWeek(dateStr)
  const times = []

  // שבת – אין שעות
  if (day === 6) return []

  // שישי – רק 12:00–13:30
  if (day === 5) {
    return ["12:00", "12:30", "13:00", "13:30"]
  }

  // כל שאר הימים
  let hour = 16
  let minute = 0

  while (hour < 20) {
    const h = hour.toString().padStart(2, "0")
    const m = minute === 0 ? "00" : "30"
    times.push(`${h}:${m}`)

    minute += 30
    if (minute === 60) {
      minute = 0
      hour++
    }
  }

  return times
}

/* ======================
   ROUTES – CLIENT
====================== */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"))
})

app.get("/admin.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin.html"))
})

/* ======================
   API – TIMES
====================== */

app.get("/api/times", (req, res) => {
  const { date } = req.query
  if (!date) return res.json([])

  const allTimes = getAvailableTimes(date)

  db.all(
    `SELECT time FROM appointments WHERE date = ? AND status = 'approved'`,
    [date],
    (err, rows) => {
      const taken = rows.map(r => r.time)
      const available = allTimes.filter(t => !taken.includes(t))
      res.json(available)
    }
  )
})

/* ======================
   API – CREATE APPOINTMENT
====================== */

app.post("/api/appointments", (req, res) => {
  const { name, date, time } = req.body
  if (!name || !date || !time) {
    return res.status(400).json({ error: "missing fields" })
  }

  db.run(
    `INSERT INTO appointments (name, date, time, status)
     VALUES (?, ?, ?, 'pending')`,
    [name, date, time],
    () => res.json({ success: true })
  )
})

/* ======================
   API – ADMIN
====================== */

app.get("/api/admin/appointments", (req, res) => {
  db.all(
    `SELECT * FROM appointments ORDER BY date, time`,
    (err, rows) => res.json(rows)
  )
})

app.post("/api/admin/suggest", (req, res) => {
  const { id, newDate, newTime } = req.body

  db.run(
    `UPDATE appointments
     SET date = ?, time = ?, status = 'suggested'
     WHERE id = ?`,
    [newDate, newTime, id],
    () => res.json({ success: true })
  )
})

app.post("/api/admin/approve", (req, res) => {
  const { id } = req.body

  db.run(
    `UPDATE appointments SET status = 'approved' WHERE id = ?`,
    [id],
    () => res.json({ success: true })
  )
})

/* ======================
   START
====================== */

app.listen(PORT, () => {
  console.log("SERVER RUNNING ON PORT", PORT)
})