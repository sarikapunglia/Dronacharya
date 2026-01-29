import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("eduquest.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    class TEXT NOT NULL,
    UNIQUE(name, age, class)
  );

  CREATE TABLE IF NOT EXISTS tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    topic TEXT NOT NULL,
    complexity TEXT NOT NULL,
    concepts TEXT NOT NULL,
    questions JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES students(id)
  );

  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER NOT NULL,
    answers JSON NOT NULL,
    score INTEGER,
    feedback TEXT,
    analysis JSON,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(test_id) REFERENCES tests(id)
  );
`);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // API Routes
  app.post("/api/login", (req, res) => {
    const { name, age, className } = req.body;
    console.log("Login request:", { name, age, className });
    try {
      let student = db.prepare("SELECT * FROM students WHERE name = ? AND age = ? AND class = ?").get(name, age, className);
      if (!student) {
        const info = db.prepare("INSERT INTO students (name, age, class) VALUES (?, ?, ?)").run(name, age, className);
        student = { id: Number(info.lastInsertRowid), name, age, class: className };
        console.log("Created new student:", student);
      } else {
        console.log("Found existing student:", student);
      }
      res.json(student);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  app.post("/api/tests", (req, res) => {
    const { studentId, topic, complexity, concepts, questions } = req.body;
    try {
      const info = db.prepare("INSERT INTO tests (student_id, topic, complexity, concepts, questions) VALUES (?, ?, ?, ?, ?)").run(
        studentId, topic, complexity, concepts, JSON.stringify(questions)
      );
      res.json({ id: info.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: "Failed to save test" });
    }
  });

  app.get("/api/students/:id/history", (req, res) => {
    try {
      const history = db.prepare(`
        SELECT t.*, r.score, r.feedback, r.analysis, r.completed_at 
        FROM tests t 
        LEFT JOIN results r ON t.id = r.test_id 
        WHERE t.student_id = ?
        ORDER BY t.created_at DESC
      `).all(req.params.id);
      
      const parsedHistory = history.map(h => ({
        ...h,
        questions: JSON.parse(h.questions),
        analysis: h.analysis ? JSON.parse(h.analysis) : null
      }));
      
      res.json(parsedHistory);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  app.post("/api/results", (req, res) => {
    const { testId, answers, score, feedback, analysis } = req.body;
    try {
      const info = db.prepare("INSERT INTO results (test_id, answers, score, feedback, analysis) VALUES (?, ?, ?, ?, ?)").run(
        testId, JSON.stringify(answers), score, feedback, JSON.stringify(analysis)
      );
      res.json({ id: info.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: "Failed to save results" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: { server }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
