export interface Student {
  id: number;
  name: string;
  age: number;
  class: string;
}

export interface Question {
  id: number;
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

export interface Test {
  id: number;
  student_id: number;
  topic: string;
  complexity: string;
  concepts: string;
  questions: Question[];
  created_at: string;
  score?: number;
  feedback?: string;
  analysis?: {
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  };
  completed_at?: string;
}
