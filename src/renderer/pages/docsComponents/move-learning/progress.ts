const STORAGE_KEY = "beluga-move-learning-progress";

export interface QuizResult {
  correct: number;
  total: number;
  percent: number;
  passed: boolean;
  completedAt: string;
}

export interface LearningProgress {
  completedLessons: string[];
  lastLessonId: string | null;
  quizResults: Record<string, QuizResult>;
}

const EMPTY: LearningProgress = {
  completedLessons: [],
  lastLessonId: null,
  quizResults: {},
};

export function loadProgress(): LearningProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<LearningProgress>;
    return {
      completedLessons: Array.isArray(parsed.completedLessons)
        ? parsed.completedLessons
        : [],
      lastLessonId:
        typeof parsed.lastLessonId === "string" ? parsed.lastLessonId : null,
      quizResults:
        parsed.quizResults && typeof parsed.quizResults === "object"
          ? (parsed.quizResults as Record<string, QuizResult>)
          : {},
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveProgress(progress: LearningProgress): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function isLessonComplete(
  progress: LearningProgress,
  lessonId: string,
): boolean {
  return progress.completedLessons.includes(lessonId);
}

export function toggleLessonComplete(
  progress: LearningProgress,
  lessonId: string,
  complete: boolean,
): LearningProgress {
  const set = new Set(progress.completedLessons);
  if (complete) set.add(lessonId);
  else set.delete(lessonId);
  return {
    ...progress,
    completedLessons: [...set],
    lastLessonId: lessonId,
  };
}

export function saveQuizResult(
  progress: LearningProgress,
  lessonId: string,
  result: QuizResult,
): LearningProgress {
  return {
    ...progress,
    quizResults: { ...progress.quizResults, [lessonId]: result },
  };
}

export function moduleProgress(
  progress: LearningProgress,
  lessonIds: string[],
): { done: number; total: number; percent: number } {
  const total = lessonIds.length;
  const done = lessonIds.filter((id) =>
    progress.completedLessons.includes(id),
  ).length;
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

export function moduleQuizPassed(
  progress: LearningProgress,
  quizLessonId: string,
): boolean {
  return progress.quizResults[quizLessonId]?.passed === true;
}