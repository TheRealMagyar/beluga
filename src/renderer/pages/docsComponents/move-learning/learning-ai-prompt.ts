import type { LessonBlock, MoveLesson, MoveModule } from "./curriculum";

function blockToText(block: LessonBlock): string {
  switch (block.type) {
    case "prose":
    case "subtitle":
      return block.text;
    case "code":
      return `[${block.language}]\n${block.code}`;
    case "tip":
      return `Tip (${block.tone}): ${block.text}`;
    case "list":
      return block.items.map((item) => `• ${item}`).join("\n");
    case "steps":
      return block.steps
        .map((s, i) => `${i + 1}. ${s.title}: ${s.body}`)
        .join("\n");
    case "compare":
      return `${block.badLabel ?? "Avoid"}: ${block.bad}\n${block.goodLabel ?? "Correct"}: ${block.good}`;
    case "keypoints":
      return `${block.title ?? "Key points"}:\n${block.items.map((item, i) => `${i + 1}. ${item}`).join("\n")}`;
    default:
      return "";
  }
}

export function lessonContentForAi(lesson: MoveLesson): string {
  return lesson.blocks.map(blockToText).filter(Boolean).join("\n\n");
}

export function buildExplainLessonPrompt(
  lesson: MoveLesson,
  module: MoveModule,
): string {
  const content = lessonContentForAi(lesson);
  const kind =
    lesson.kind === "quiz"
      ? "module quiz"
      : lesson.kind === "recap"
        ? "module recap"
        : "lesson";

  return `I'm studying the Beluga "Learn Move from zero" course (Sui Move for complete beginners).

Module ${module.order}: ${module.title}
${kind}: ${lesson.title}
Summary: ${lesson.summary}
Learning goal: ${lesson.goal}

--- Lesson content ---
${content}
${lesson.exercise ? `\n--- Exercise ---\n${lesson.exercise.prompt}\nHint: ${lesson.exercise.hint}` : ""}

Please explain this in simpler language with:
1. A plain-English summary of what this concept is and why it matters on Sui
2. One concrete analogy
3. A tiny code example only if it helps
4. One common beginner mistake to avoid

Keep it friendly and concise.`;
}

export function buildExplainExercisePrompt(
  lesson: MoveLesson,
  module: MoveModule,
): string {
  if (!lesson.exercise) return buildExplainLessonPrompt(lesson, module);
  return `I'm on the Beluga Move learning course.

Module ${module.order}: ${module.title} — ${lesson.title}

Exercise:
${lesson.exercise.prompt}

Hint given: ${lesson.exercise.hint}

Do NOT give me the full solution immediately. Guide me step by step with questions and small hints so I can solve it myself. If I'm stuck, offer one more concrete hint.`;
}

export function buildExplainQuizQuestionPrompt(
  lesson: MoveLesson,
  module: MoveModule,
  questionPrompt: string,
  userAnswer: string,
  correctAnswer: string,
  explanation: string,
): string {
  return `I'm taking the quiz in Beluga's Move course.

Module ${module.order}: ${module.title}
Quiz: ${lesson.title}

Question: ${questionPrompt}
My answer: ${userAnswer}
Correct answer: ${correctAnswer}
Official explanation: ${explanation}

Explain why the correct answer is right and why my choice was wrong (if it was). Use beginner-friendly language.`;
}