import type { MoveModule, MoveLesson, Quiz, LessonBlock } from "./types";
import { MODULE_EXTRAS } from "./module-extras";

function recapLesson(module: MoveModule): MoveLesson | null {
  const extra = MODULE_EXTRAS[module.id];
  if (!extra) return null;
  return {
    id: `${module.id}-recap`,
    kind: "recap",
    title: `${module.title} — Recap`,
    duration: "5 min",
    summary: "Key takeaways before the quiz.",
    goal: "Solidify what you learned in this module.",
    blocks: extra.recapBlocks,
  };
}

function quizLesson(module: MoveModule): MoveLesson | null {
  const extra = MODULE_EXTRAS[module.id];
  if (!extra) return null;
  return {
    id: `${module.id}-quiz`,
    kind: "quiz",
    title: `${module.title} — Quiz`,
    duration: `${Math.max(5, extra.quiz.questions.length * 2)} min`,
    summary: "Test your knowledge — pass to finish the module.",
    goal: `Score at least ${extra.quiz.passPercent}% to confirm you're ready for the next module.`,
    blocks: extra.quizIntro ?? [],
    quiz: extra.quiz,
  };
}

export function enrichModule(module: MoveModule): MoveModule {
  const recap = recapLesson(module);
  const quiz = quizLesson(module);
  const tail = [recap, quiz].filter((l): l is MoveLesson => l !== null);
  if (tail.length === 0) return module;
  return { ...module, lessons: [...module.lessons, ...tail] };
}

export function enrichCurriculum(modules: MoveModule[]): MoveModule[] {
  return modules.map(enrichModule).sort((a, b) => a.order - b.order);
}