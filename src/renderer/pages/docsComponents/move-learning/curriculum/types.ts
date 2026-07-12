export type LessonBlock =
  | { type: "prose"; text: string }
  | { type: "subtitle"; text: string }
  | { type: "code"; language: string; code: string }
  | { type: "tip"; tone: "info" | "warning" | "success"; text: string }
  | { type: "list"; items: string[] }
  | { type: "steps"; steps: { title: string; body: string }[] }
  | {
      type: "compare";
      goodLabel?: string;
      badLabel?: string;
      good: string;
      bad: string;
    }
  | { type: "keypoints"; title?: string; items: string[] };

export type LessonKind = "lesson" | "recap" | "quiz";

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
  correctOptionId: string;
  explanation: string;
}

export interface Quiz {
  passPercent: number;
  questions: QuizQuestion[];
}

export interface MoveLesson {
  id: string;
  title: string;
  duration: string;
  summary: string;
  goal: string;
  kind?: LessonKind;
  blocks: LessonBlock[];
  exercise?: {
    prompt: string;
    hint: string;
    solution?: string;
  };
  quiz?: Quiz;
}

export interface MoveModule {
  id: string;
  order: number;
  title: string;
  description: string;
  accent: string;
  icon: string;
  lessons: MoveLesson[];
}