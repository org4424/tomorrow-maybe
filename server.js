import express from "express"
import sqlite3 from "sqlite3"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(express.json())
app.use(express.static("public"))

const db = new sqlite3.Database("appointments.db")

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
   TIMES BY DATE
====================== */
app.get("/api/times", (req, res) => {
  const { date } = req.query
  if (!date) return res.json([])

  const day = new Date(date).getDay()
  let times = []

  // שבת
  if (day === 6) return res.json([])

  // שישי
  if (day === 5) {
    times = ["12:00", "12:30", "13:00", "13:30"]
  } else {
    for (let h = 16; h <= 19; h++) {
      times.push(`${h}:00`)
      if (h !== 19) times.push(`${h}:30`)
    }
  }

  db.all(
    "SELECT time FROM appointments WHERE date=? AND status!='cancelled'",
    [date],
    (err, rows) => {
      const taken = rows.map(r => r.time)
      const available = times.filter(t => !taken.includes(t))
      res.json(available)
    }
  )
})

/* ======================
   CREATE APPOINTMENT
====================== */
app.post("/api/appointments", (req, res) => {
  const { name, date, time } = req.body
  if (!name || !date || !time) return res.sendStatus(400)

  db.run(
    "INSERT INTO appointments (name,date,time,status) VALUES (?,?,?,?)",
    [name, date, time, "active"],
    () => res.sendStatus(200)
  )
})

/* ======================
   ADMIN LIST
====================== */
app.get("/api/admin/appointments", (req, res) => {
  db.all(
    "SELECT * FROM appointments WHERE status='active' ORDER BY date,time",
    [],
    (err, rows) => res.json(rows)
  )
})

/* ======================
   CANCEL
====================== */
app.post("/api/appointments/cancel", (req, res) => {
  const { id } = req.body
  db.run(
    "UPDATE appointments SET status='cancelled' WHERE id=?",
    [id],
    () => res.sendStatus(200)
  )
})

app.listen(3000, () => {
  console.log("SERVER RUNNING")
})