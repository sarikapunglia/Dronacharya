import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

class DataService {
  private sqlite: SQLiteConnection | null = null;
  private db: SQLiteDBConnection | null = null;
  private isMobile: boolean;

  constructor() {
    this.isMobile = Capacitor.getPlatform() !== 'web';
    if (this.isMobile) {
      this.sqlite = new SQLiteConnection(CapacitorSQLite);
    }
  }

  async init() {
    if (!this.isMobile) return;

    try {
      this.db = await this.sqlite!.createConnection('dronacharya_local', false, 'no-encryption', 1, false);
      await this.db.open();

      // Initialize tables locally if they don't exist
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS students (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          age INTEGER NOT NULL,
          class TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL,
          topic TEXT NOT NULL,
          complexity TEXT NOT NULL,
          concepts TEXT NOT NULL,
          questions TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          test_id INTEGER NOT NULL,
          answers TEXT NOT NULL,
          score INTEGER,
          feedback TEXT,
          analysis TEXT,
          completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Local SQLite initialized');
    } catch (err) {
      console.error('SQLite init failed', err);
    }
  }

  // Generic method to handle API vs Local
  async login(name: string, age: number, className: string) {
    if (!this.isMobile) {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, age, className })
      });
      return res.json();
    } else {
      // Local SQLite Login
      const result = await this.db!.query('SELECT * FROM students WHERE name = ? AND age = ? AND class = ?', [name, age, className]);
      if (result.values && result.values.length > 0) {
        return result.values[0];
      } else {
        const insert = await this.db!.run('INSERT INTO students (name, age, class) VALUES (?, ?, ?)', [name, age, className]);
        return { id: insert.changes?.lastId, name, age, class: className };
      }
    }
  }

  async saveTest(studentId: number, topic: string, complexity: string, concepts: string, questions: any) {
    if (!this.isMobile) {
      const res = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, topic, complexity, concepts, questions })
      });
      return res.json();
    } else {
      const insert = await this.db!.run(
        'INSERT INTO tests (student_id, topic, complexity, concepts, questions) VALUES (?, ?, ?, ?, ?)',
        [studentId, topic, complexity, concepts, JSON.stringify(questions)]
      );
      return { id: insert.changes?.lastId };
    }
  }

  async getHistory(studentId: number) {
    if (!this.isMobile) {
      const res = await fetch(`/api/students/${studentId}/history`);
      return res.json();
    } else {
      const result = await this.db!.query(`
        SELECT t.*, r.score, r.feedback, r.analysis, r.completed_at 
        FROM tests t 
        LEFT JOIN results r ON t.id = r.test_id 
        WHERE t.student_id = ?
        ORDER BY t.created_at DESC
      `, [studentId]);
      
      return (result.values || []).map(h => ({
        ...h,
        questions: JSON.parse(h.questions),
        analysis: h.analysis ? JSON.parse(h.analysis) : null
      }));
    }
  }

  async saveResult(testId: number, answers: any, score: number, feedback: string, analysis: any) {
    if (!this.isMobile) {
      const res = await fetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, answers, score, feedback, analysis })
      });
      return res.json();
    } else {
      const insert = await this.db!.run(
        'INSERT INTO results (test_id, answers, score, feedback, analysis) VALUES (?, ?, ?, ?, ?)',
        [testId, JSON.stringify(answers), score, feedback, JSON.stringify(analysis)]
      );
      return { id: insert.changes?.lastId };
    }
  }
}

export const dataService = new DataService();
