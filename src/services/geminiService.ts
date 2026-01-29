import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Question {
  id: number;
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

export interface TestGenerationParams {
  age: number;
  className: string;
  topic: string;
  complexity: 'Easy' | 'Medium' | 'Hard';
  concepts: string;
}

export const generateQuestions = async (params: TestGenerationParams): Promise<Question[]> => {
  const prompt = `Generate a set of 10 educational questions for a student.
    Student Details: Age ${params.age}, Class ${params.className}.
    Topic: ${params.topic}.
    Complexity: ${params.complexity}.
    Key Concepts to cover: ${params.concepts}.
    
    Provide the output as a JSON array of objects. Each object MUST be a multiple-choice question. Each object should have:
    - id: number
    - question: string
    - options: string[] (MUST provide exactly 4 distinct options)
    - correctAnswer: string (must be one of the options)
    - explanation: string`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.NUMBER },
            question: { type: Type.STRING },
            options: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            correctAnswer: { type: Type.STRING },
            explanation: { type: Type.STRING },
          },
          required: ["id", "question", "correctAnswer", "explanation"],
        },
      },
    },
  });

  return JSON.parse(response.text || "[]");
};

export interface EvaluationResult {
  score: number;
  feedback: string;
  analysis: {
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  };
}

export const evaluateAnswers = async (
  questions: Question[],
  studentAnswers: Record<number, string>,
  params: TestGenerationParams
): Promise<EvaluationResult> => {
  const prompt = `Evaluate the following student answers for a test.
    Student Details: Age ${params.age}, Class ${params.className}.
    Topic: ${params.topic}.
    
    Questions and Correct Answers:
    ${JSON.stringify(questions, null, 2)}
    
    Student's Answers:
    ${JSON.stringify(studentAnswers, null, 2)}
    
    Provide a score (0-100), overall feedback, and a detailed analysis of strengths, weaknesses, and suggestions for improvement.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          feedback: { type: Type.STRING },
          analysis: {
            type: Type.OBJECT,
            properties: {
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
              suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["strengths", "weaknesses", "suggestions"],
          },
        },
        required: ["score", "feedback", "analysis"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
};
