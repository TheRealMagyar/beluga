import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  GraduationCap,
  HelpCircle,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Target,
  XCircle,
} from "lucide-react";
import {
  ALL_LESSON_IDS,
  MOVE_CURRICULUM,
  TOTAL_LESSONS,
  adjacentLesson,
  findLesson,
  firstLessonId,
  type LessonBlock,
  type MoveLesson,
  type MoveModule,
  type Quiz,
} from "./curriculum";
import { ExplainWithAiButton } from "./ExplainWithAiButton";
import {
  buildExplainExercisePrompt,
  buildExplainLessonPrompt,
  buildExplainQuizQuestionPrompt,
} from "./learning-ai-prompt";
import {
  loadProgress,
  moduleProgress,
  saveProgress,
  saveQuizResult,
  toggleLessonComplete,
  type LearningProgress,
  type QuizResult,
} from "./progress";

function ProgressBar({
  percent,
  accent = "#4ca3ff",
  height = 6,
}: {
  percent: number;
  accent?: string;
  height?: number;
}) {
  return (
    <div
      className="w-full rounded-full bg-[#2a2a3c] overflow-hidden"
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{ width: `${percent}%`, background: accent }}
      />
    </div>
  );
}

function LessonCodeBlock({
  code,
  language,
}: {
  code: string;
  language: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative my-4 rounded-xl overflow-hidden border border-[#2a2a3c]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1c1c2a] border-b border-[#2a2a3c]">
        <span className="text-[11px] font-mono text-[#8888a0] uppercase tracking-wide">
          {language}
        </span>
        <button
          type="button"
          onClick={copy}
          className="text-[11px] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer"
        >
          {copied ? (
            <span className="text-[#00d4aa]">Copied</span>
          ) : (
            "Copy"
          )}
        </button>
      </div>
      <pre className="bg-[#0d0d18] p-4 overflow-x-auto text-[13px] leading-relaxed">
        <code className="text-[#a8d4ff] font-mono whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}

function LessonTip({
  tone,
  text,
}: {
  tone: "info" | "warning" | "success";
  text: string;
}) {
  const styles = {
    info: {
      border: "border-[#4ca3ff]/25",
      bg: "bg-[#4ca3ff]/6",
      text: "text-[#4ca3ff]",
    },
    warning: {
      border: "border-[#ffb347]/25",
      bg: "bg-[#ffb347]/6",
      text: "text-[#ffb347]",
    },
    success: {
      border: "border-[#00d4aa]/25",
      bg: "bg-[#00d4aa]/6",
      text: "text-[#00d4aa]",
    },
  }[tone];

  return (
    <div
      className={`flex gap-3 p-4 rounded-xl border ${styles.border} ${styles.bg} my-4`}
    >
      <Lightbulb size={16} className={`flex-shrink-0 mt-0.5 ${styles.text}`} />
      <p className="text-[13px] text-[#c0c0d0] leading-relaxed">{text}</p>
    </div>
  );
}

function renderBlock(block: LessonBlock, key: number) {
  switch (block.type) {
    case "prose":
      return (
        <p key={key} className="text-[14px] text-[#a8a8c0] leading-relaxed mb-4">
          {block.text}
        </p>
      );
    case "subtitle":
      return (
        <h4
          key={key}
          className="text-[15px] font-semibold text-[#4ca3ff] mt-6 mb-2"
        >
          {block.text}
        </h4>
      );
    case "code":
      return (
        <LessonCodeBlock key={key} code={block.code} language={block.language} />
      );
    case "tip":
      return <LessonTip key={key} tone={block.tone} text={block.text} />;
    case "list":
      return (
        <ul key={key} className="list-disc pl-5 mb-5 space-y-2">
          {block.items.map((item, i) => (
            <li
              key={i}
              className="text-[14px] text-[#a8a8c0] leading-relaxed"
            >
              {item}
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol key={key} className="space-y-3 mb-5">
          {block.steps.map((step, i) => (
            <li
              key={i}
              className="flex gap-3 rounded-xl border border-[#2a2a3c] bg-[#14141f] px-4 py-3"
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-[#4ca3ff]/15 text-[#9ed0ff] text-[11px] font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <div>
                <p className="text-[13px] font-semibold text-[#f0f0f5] mb-0.5">
                  {step.title}
                </p>
                <p className="text-[13px] text-[#8888a0] leading-relaxed">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      );
    case "compare":
      return (
        <div key={key} className="grid grid-cols-1 md:grid-cols-2 gap-3 my-4">
          <div className="rounded-xl border border-[#ff4d6d]/25 bg-[#ff4d6d]/06 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#ff8fa3] mb-2">
              {block.badLabel ?? "Avoid"}
            </p>
            <pre className="text-[12px] font-mono text-[#c0a0a8] whitespace-pre-wrap">
              {block.bad}
            </pre>
          </div>
          <div className="rounded-xl border border-[#00d4aa]/25 bg-[#00d4aa]/06 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#00d4aa] mb-2">
              {block.goodLabel ?? "Correct"}
            </p>
            <pre className="text-[12px] font-mono text-[#a8d4c8] whitespace-pre-wrap">
              {block.good}
            </pre>
          </div>
        </div>
      );
    case "keypoints":
      return (
        <div
          key={key}
          className="rounded-2xl border border-[#4ca3ff]/20 bg-[#4ca3ff]/06 p-5 my-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-[#4ca3ff]" />
            <p className="text-[12px] font-bold uppercase tracking-wide text-[#7ec4ff]">
              {block.title ?? "Key takeaways"}
            </p>
          </div>
          <ul className="space-y-2.5">
            {block.items.map((item, i) => (
              <li key={i} className="flex gap-2.5 text-[14px] text-[#c0c8e0] leading-relaxed">
                <span className="flex-shrink-0 w-5 h-5 rounded-md bg-[#4ca3ff]/15 text-[#9ed0ff] text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      );
    default:
      return null;
  }
}

function lessonKindLabel(kind: MoveLesson["kind"]): string | null {
  if (kind === "recap") return "Recap";
  if (kind === "quiz") return "Quiz";
  return null;
}

function QuizPanel({
  quiz,
  lesson,
  module,
  moduleAccent,
  savedResult,
  onSubmit,
}: {
  quiz: Quiz;
  lesson: MoveLesson;
  module: MoveModule;
  moduleAccent: string;
  savedResult?: QuizResult;
  onSubmit: (result: QuizResult) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(Boolean(savedResult));
  const [result, setResult] = useState<QuizResult | null>(savedResult ?? null);

  const total = quiz.questions.length;
  const answered = quiz.questions.filter((q) => answers[q.id]).length;
  const allAnswered = answered === total;

  const handleSubmit = () => {
    if (!allAnswered) return;
    let correct = 0;
    for (const question of quiz.questions) {
      if (answers[question.id] === question.correctOptionId) correct += 1;
    }
    const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
    const next: QuizResult = {
      correct,
      total,
      percent,
      passed: percent >= quiz.passPercent,
      completedAt: new Date().toISOString(),
    };
    setResult(next);
    setSubmitted(true);
    onSubmit(next);
  };

  const retry = () => {
    setAnswers({});
    setSubmitted(false);
    setResult(null);
  };

  return (
    <div className="space-y-5 mb-8">
      <div
        className="rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-3"
        style={{
          borderColor: `${moduleAccent}35`,
          background: `${moduleAccent}0a`,
        }}
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#8888a0] mb-0.5">
            Module quiz
          </p>
          <p className="text-[14px] font-semibold text-[#f0f0f5]">
            {total} questions · pass {quiz.passPercent}%
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExplainWithAiButton
            variant="inline"
            label="Explain quiz topics"
            prompt={buildExplainLessonPrompt(lesson, module)}
          />
          <span className="text-[12px] text-[#8888a0] tabular-nums">
            {answered}/{total} answered
          </span>
        </div>
      </div>

      {quiz.questions.map((question, qi) => {
        const picked = answers[question.id];
        const showFeedback = submitted;
        const isCorrect = picked === question.correctOptionId;

        return (
          <div
            key={question.id}
            className="rounded-2xl border border-[#2a2a3c] bg-[#14141f] p-5"
          >
            <p className="text-[10px] font-bold text-[#55556a] uppercase tracking-wide mb-2">
              Question {qi + 1}
            </p>
            <p className="text-[15px] font-medium text-[#f0f0f5] leading-relaxed mb-4">
              {question.prompt}
            </p>
            <div className="space-y-2">
              {question.options.map((opt) => {
                const selected = picked === opt.id;
                const isAnswer = opt.id === question.correctOptionId;
                let borderClass = "border-[#2a2a3c]";
                let bgClass = "bg-[#1a1a26]";
                let inlineBorder: string | undefined;
                if (showFeedback && selected && isCorrect) {
                  borderClass = "border-[#00d4aa]/40";
                  bgClass = "bg-[#00d4aa]/10";
                } else if (showFeedback && selected && !isCorrect) {
                  borderClass = "border-[#ff4d6d]/40";
                  bgClass = "bg-[#ff4d6d]/10";
                } else if (showFeedback && isAnswer) {
                  borderClass = "border-[#00d4aa]/30";
                  bgClass = "bg-[#00d4aa]/06";
                } else if (selected) {
                  borderClass = "border-[#4ca3ff]/40";
                  bgClass = "bg-[#4ca3ff]/10";
                  inlineBorder = `${moduleAccent}66`;
                }

                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={submitted}
                    onClick={() =>
                      setAnswers((prev) => ({ ...prev, [question.id]: opt.id }))
                    }
                    style={
                      inlineBorder && !showFeedback
                        ? { borderColor: inlineBorder }
                        : undefined
                    }
                    className={`w-full text-left px-4 py-3 rounded-xl border ${borderClass} ${bgClass} cursor-pointer transition-colors disabled:cursor-default flex items-center gap-3`}
                  >
                    <span
                      className={`flex-shrink-0 w-6 h-6 rounded-full border text-[11px] font-bold flex items-center justify-center ${
                        selected
                          ? "border-[#4ca3ff] bg-[#4ca3ff]/20 text-[#9ed0ff]"
                          : "border-[#444466] text-[#666688]"
                      }`}
                    >
                      {opt.id.toUpperCase()}
                    </span>
                    <span className="text-[13px] text-[#c0c0d8] leading-relaxed">
                      {opt.text}
                    </span>
                    {showFeedback && isAnswer ? (
                      <Check size={14} className="ml-auto text-[#00d4aa] flex-shrink-0" />
                    ) : null}
                    {showFeedback && selected && !isCorrect ? (
                      <XCircle size={14} className="ml-auto text-[#ff4d6d] flex-shrink-0" />
                    ) : null}
                  </button>
                );
              })}
            </div>
            {showFeedback ? (
              <div className="mt-3 border-t border-[#2a2a3c] pt-3 space-y-2">
                <p className="text-[13px] text-[#8888a0] leading-relaxed">
                  <span className="text-[#9ed0ff] font-medium">Explanation: </span>
                  {question.explanation}
                </p>
                {picked && !isCorrect ? (
                  <ExplainWithAiButton
                    variant="inline"
                    label="Explain with AI"
                    prompt={buildExplainQuizQuestionPrompt(
                      lesson,
                      module,
                      question.prompt,
                      question.options.find((o) => o.id === picked)?.text ?? picked,
                      question.options.find((o) => o.id === question.correctOptionId)
                        ?.text ?? question.correctOptionId,
                      question.explanation,
                    )}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}

      {!submitted ? (
        <button
          type="button"
          disabled={!allAnswered}
          onClick={handleSubmit}
          className="w-full py-3 rounded-xl bg-[#4ca3ff]/18 border border-[#4ca3ff]/40 text-[#9ed0ff] text-[14px] font-semibold cursor-pointer hover:bg-[#4ca3ff]/26 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Check answers
        </button>
      ) : result ? (
        <div
          className={`rounded-2xl border p-5 ${
            result.passed
              ? "border-[#00d4aa]/35 bg-[#00d4aa]/08"
              : "border-[#ffb347]/35 bg-[#ffb347]/08"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              {result.passed ? (
                <CheckCircle2 size={20} className="text-[#00d4aa]" />
              ) : (
                <XCircle size={20} className="text-[#ffb347]" />
              )}
              <p className="text-[16px] font-bold text-[#f0f0f5]">
                {result.correct}/{result.total} correct ({result.percent}%)
              </p>
            </div>
            <span
              className={`text-[12px] font-semibold px-2.5 py-1 rounded-full ${
                result.passed
                  ? "bg-[#00d4aa]/15 text-[#00d4aa]"
                  : "bg-[#ffb347]/15 text-[#ffb347]"
              }`}
            >
              {result.passed ? "Passed" : `Need ${quiz.passPercent}%`}
            </span>
          </div>
          <p className="text-[13px] text-[#8888a0] mb-4">
            {result.passed
              ? "Great work — mark complete and continue to the next module."
              : "Review the recap lesson and try again."}
          </p>
          {!result.passed ? (
            <button
              type="button"
              onClick={retry}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#2a2a3c] text-[13px] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer"
            >
              <RotateCcw size={14} />
              Retry quiz
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ExerciseCard({
  exercise,
  lesson,
  module,
}: {
  exercise: NonNullable<MoveLesson["exercise"]>;
  lesson: MoveLesson;
  module: MoveModule;
}) {
  const [showSolution, setShowSolution] = useState(false);

  return (
    <div className="rounded-2xl border border-[#6c63ff]/25 bg-[#6c63ff]/06 p-5 mb-8">
      <p className="text-[11px] font-bold uppercase tracking-[1px] text-[#9d97ff] mb-2">
        Try it yourself
      </p>
      <p className="text-[14px] text-[#d8d8e8] leading-relaxed mb-3">
        {exercise.prompt}
      </p>
      <p className="text-[13px] text-[#666688] mb-3">
        <span className="text-[#8888a0]">Hint:</span> {exercise.hint}
      </p>
      <div className="mb-3">
        <ExplainWithAiButton
          variant="subtle"
          label="Help me with AI"
          prompt={buildExplainExercisePrompt(lesson, module)}
        />
      </div>
      {exercise.solution ? (
        <div>
          <button
            type="button"
            onClick={() => setShowSolution((v) => !v)}
            className="text-[12px] font-medium text-[#9d97ff] hover:text-[#c4c0ff] cursor-pointer"
          >
            {showSolution ? "Hide solution" : "Show solution"}
          </button>
          {showSolution ? (
            <pre className="mt-3 rounded-xl bg-[#0d0d18] border border-[#2a2a3c] p-3 text-[12px] font-mono text-[#a8d4ff] overflow-x-auto">
              {exercise.solution}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function LessonView({
  lesson,
  module,
  moduleAccent,
  moduleTitle,
  moduleOrder,
  lessonIndex,
  lessonTotal,
  globalIndex,
  progress,
  onToggleComplete,
  onSelectLesson,
  onQuizSubmit,
}: {
  lesson: MoveLesson;
  module: MoveModule;
  moduleAccent: string;
  moduleTitle: string;
  moduleOrder: number;
  lessonIndex: number;
  lessonTotal: number;
  globalIndex: number;
  progress: LearningProgress;
  onToggleComplete: (complete: boolean) => void;
  onSelectLesson: (id: string) => void;
  onQuizSubmit: (lessonId: string, result: QuizResult) => void;
}) {
  const complete = progress.completedLessons.includes(lesson.id);
  const { prev, next } = adjacentLesson(lesson.id);
  const kind = lesson.kind ?? "lesson";
  const kindBadge = lessonKindLabel(kind);
  const quizResult = progress.quizResults[lesson.id];
  const quizPassed = kind === "quiz" && quizResult?.passed === true;
  const canComplete =
    kind !== "quiz" || quizPassed;

  const handleQuizSubmit = (result: QuizResult) => {
    onQuizSubmit(lesson.id, result);
    if (result.passed && !complete) {
      onToggleComplete(true);
    }
  };

  return (
    <div className="packages-panel-in">
      <div className="flex flex-wrap items-center gap-2 mb-4 text-[11px]">
        <span className="text-[#55556a] tabular-nums">
          Lesson {globalIndex + 1} of {TOTAL_LESSONS}
        </span>
        <span className="text-[#3a3a48]">·</span>
        <span
          className="font-semibold px-2 py-0.5 rounded-full border"
          style={{
            color: moduleAccent,
            borderColor: `${moduleAccent}40`,
            background: `${moduleAccent}12`,
          }}
        >
          Module {moduleOrder}: {moduleTitle}
        </span>
        {kindBadge ? (
          <>
            <span className="text-[#3a3a48]">·</span>
            <span
              className={`font-semibold px-2 py-0.5 rounded-full border ${
                kind === "quiz"
                  ? "text-[#ffb347] border-[#ffb347]/40 bg-[#ffb347]/12"
                  : "text-[#9ed0ff] border-[#4ca3ff]/40 bg-[#4ca3ff]/12"
              }`}
            >
              {kindBadge}
            </span>
          </>
        ) : null}
        <span className="text-[#3a3a48]">·</span>
        <span className="text-[#666688]">
          {lessonIndex + 1}/{lessonTotal} in module · {lesson.duration}
        </span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <h2 className="text-[24px] font-bold text-[#f0f0f5] tracking-tight flex-1 min-w-0">
          {lesson.title}
        </h2>
        <ExplainWithAiButton
          variant="subtle"
          prompt={buildExplainLessonPrompt(lesson, module)}
        />
      </div>
      <p className="text-[14px] text-[#8888a0] mb-4 leading-relaxed">
        {lesson.summary}
      </p>

      {kind === "recap" ? (
        <div className="flex items-start gap-3 rounded-xl border border-[#4ca3ff]/25 bg-[#4ca3ff]/08 px-4 py-4 mb-6">
          <ClipboardList size={18} className="text-[#4ca3ff] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-semibold text-[#9ed0ff] mb-1">
              Module recap
            </p>
            <p className="text-[13px] text-[#8888a0] leading-relaxed">
              Review these points, then take the quiz to lock in the module.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex items-start gap-2 rounded-xl border border-[#4ca3ff]/20 bg-[#4ca3ff]/06 px-4 py-3 mb-8">
        <Target size={16} className="text-[#4ca3ff] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#7ec4ff] mb-0.5">
            {kind === "quiz" ? "Your goal" : "After this lesson you will"}
          </p>
          <p className="text-[13px] text-[#c7d8f0] leading-relaxed">
            {lesson.goal}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <ExplainWithAiButton
          variant="primary"
          label="Explain this lesson with AI"
          prompt={buildExplainLessonPrompt(lesson, module)}
          className="w-full sm:w-auto justify-center"
        />
      </div>

      <div className="mb-8">{lesson.blocks.map(renderBlock)}</div>

      {lesson.exercise ? (
        <ExerciseCard exercise={lesson.exercise} lesson={lesson} module={module} />
      ) : null}

      {lesson.quiz ? (
        <QuizPanel
          quiz={lesson.quiz}
          lesson={lesson}
          module={module}
          moduleAccent={moduleAccent}
          savedResult={quizResult}
          onSubmit={handleQuizSubmit}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-[#2a2a3c]">
        <div>
          <button
            type="button"
            disabled={!canComplete && !complete}
            onClick={() => onToggleComplete(!complete)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium cursor-pointer border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              complete
                ? "border-[#00d4aa]/35 bg-[#00d4aa]/12 text-[#00d4aa]"
                : "border-[#2a2a3c] bg-[#1e1e1e] text-[#8888a0] hover:border-[#444466] hover:text-[#f0f0f5]"
            }`}
          >
            {complete ? <CheckCircle2 size={16} /> : <Circle size={16} />}
            {complete
              ? "Lesson completed"
              : kind === "quiz"
                ? "Pass quiz to complete"
                : "Mark as complete & continue"}
          </button>
          {kind === "quiz" && !quizPassed && !complete ? (
            <p className="text-[11px] text-[#666688] mt-2">
              Answer all questions and reach {lesson.quiz?.passPercent}% to
              finish this module.
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!prev}
            onClick={() => prev && onSelectLesson(prev)}
            className="flex items-center gap-1 px-3 py-2 rounded-xl border border-[#2a2a3c] text-[12px] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={14} />
            Previous
          </button>
          <button
            type="button"
            disabled={!next}
            onClick={() => next && onSelectLesson(next)}
            className="flex items-center gap-1 px-3 py-2 rounded-xl border border-[#4ca3ff]/35 bg-[#4ca3ff]/12 text-[12px] text-[#9ed0ff] hover:bg-[#4ca3ff]/20 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next lesson
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function MoveLearningSection() {
  const [progress, setProgress] = useState<LearningProgress>(() =>
    loadProgress(),
  );
  const [activeLessonId, setActiveLessonId] = useState<string | null>(() => {
    const saved = loadProgress();
    return saved.lastLessonId;
  });
  const [expandedModule, setExpandedModule] = useState<string | null>(
    MOVE_CURRICULUM[0]?.id ?? null,
  );

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  const overall = useMemo(() => {
    const done = progress.completedLessons.filter((id) =>
      ALL_LESSON_IDS.includes(id),
    ).length;
    return {
      done,
      total: TOTAL_LESSONS,
      percent:
        TOTAL_LESSONS === 0
          ? 0
          : Math.round((done / TOTAL_LESSONS) * 100),
    };
  }, [progress]);

  const active = activeLessonId ? findLesson(activeLessonId) : null;

  const persistLesson = useCallback((lessonId: string | null) => {
    setActiveLessonId(lessonId);
    if (lessonId) {
      setProgress((prev) => ({ ...prev, lastLessonId: lessonId }));
      const found = findLesson(lessonId);
      if (found) setExpandedModule(found.module.id);
    }
  }, []);

  const handleToggleComplete = useCallback(
    (lessonId: string, complete: boolean) => {
      setProgress((prev) => {
        const next = toggleLessonComplete(prev, lessonId, complete);
        if (complete) {
          const { next: nextId } = adjacentLesson(lessonId);
          if (nextId) {
            setTimeout(() => persistLesson(nextId), 0);
          }
        }
        return next;
      });
    },
    [persistLesson],
  );

  const handleQuizSubmit = useCallback(
    (lessonId: string, result: QuizResult) => {
      setProgress((prev) => saveQuizResult(prev, lessonId, result));
    },
    [],
  );

  return (
    <div>
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-[#4ca3ff]/12 border border-[#4ca3ff]/25 flex items-center justify-center text-[#4ca3ff]">
          <GraduationCap size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-[#f0f0f5] tracking-tight">
            Learn Move from zero
          </h2>
          <p className="text-[14px] text-[#8888a0] mt-1.5 leading-relaxed max-w-2xl">
            No prior Move knowledge needed. Follow the modules in order — each
            lesson explains one concept in depth, with a recap and quiz at the
            end of every module.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#2a2a3c] bg-[#1a1a26] p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-[#4ca3ff]" />
            <span className="text-[13px] font-semibold text-[#f0f0f5]">
              Your progress
            </span>
          </div>
          <span className="text-[12px] text-[#8888a0] tabular-nums">
            {overall.done} / {overall.total} lessons · {overall.percent}%
          </span>
        </div>
        <ProgressBar percent={overall.percent} />
        <p className="text-[11px] text-[#55556a] mt-2">
          {MOVE_CURRICULUM.length} modules · start at Module 1 if this is your
          first time
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <aside className="lg:sticky lg:top-6 lg:self-start max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
          <p className="text-[10px] font-bold text-[#666688] uppercase tracking-[1.2px] mb-3 px-1">
            Learning path
          </p>
          <div className="space-y-2">
            {MOVE_CURRICULUM.map((mod) => {
              const lessonIds = mod.lessons.map((l) => l.id);
              const modProg = moduleProgress(progress, lessonIds);
              const expanded = expandedModule === mod.id;

              return (
                <div
                  key={mod.id}
                  className="rounded-2xl border border-[#2a2a3c] bg-[#14141f] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedModule(expanded ? null : mod.id)
                    }
                    className="w-full text-left px-4 py-3.5 hover:bg-[#1a1a26] cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span className="text-lg">{mod.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-[#55556a] uppercase tracking-wide">
                          Module {mod.order}
                        </p>
                        <p className="text-[13px] font-semibold text-[#f0f0f5] truncate">
                          {mod.title}
                        </p>
                        <p className="text-[10px] text-[#666688] mt-0.5 line-clamp-2 leading-snug">
                          {mod.description}
                        </p>
                      </div>
                      <ChevronRight
                        size={14}
                        className={`text-[#666688] transition-transform flex-shrink-0 ${
                          expanded ? "rotate-90" : ""
                        }`}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <ProgressBar
                        percent={modProg.percent}
                        accent={mod.accent}
                        height={4}
                      />
                      <span className="text-[10px] text-[#666688] tabular-nums flex-shrink-0">
                        {modProg.done}/{modProg.total}
                      </span>
                    </div>
                  </button>

                  {expanded ? (
                    <div className="border-t border-[#2a2a3c] py-1">
                      {mod.lessons.map((lesson, li) => {
                        const done = progress.completedLessons.includes(
                          lesson.id,
                        );
                        const isActive = activeLessonId === lesson.id;
                        const kind = lesson.kind ?? "lesson";
                        const quizScore = progress.quizResults[lesson.id];
                        return (
                          <button
                            key={lesson.id}
                            type="button"
                            onClick={() => persistLesson(lesson.id)}
                            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left cursor-pointer transition-colors ${
                              isActive
                                ? "bg-[#4ca3ff]/10"
                                : "hover:bg-[#1e1e2a]"
                            } ${kind === "quiz" ? "border-l-2 border-l-[#ffb347]/50" : ""} ${kind === "recap" ? "border-l-2 border-l-[#4ca3ff]/40" : ""}`}
                          >
                            <span
                              className={`flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold ${
                                done
                                  ? "border-[#00d4aa] bg-[#00d4aa]/15 text-[#00d4aa]"
                                  : isActive
                                    ? kind === "quiz"
                                      ? "border-[#ffb347] text-[#ffb347]"
                                      : kind === "recap"
                                        ? "border-[#4ca3ff] text-[#4ca3ff]"
                                        : "border-[#4ca3ff] text-[#4ca3ff]"
                                    : kind === "quiz"
                                      ? "border-[#ffb347]/50 text-[#ffb347]"
                                      : kind === "recap"
                                        ? "border-[#4ca3ff]/40 text-[#4ca3ff]"
                                        : "border-[#444466] text-[#666688]"
                              }`}
                            >
                              {done ? (
                                <Check size={11} />
                              ) : kind === "quiz" ? (
                                <HelpCircle size={11} />
                              ) : kind === "recap" ? (
                                <ClipboardList size={11} />
                              ) : (
                                li + 1
                              )}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span
                                className={`text-[12px] leading-snug block ${
                                  isActive
                                    ? "text-[#9ed0ff] font-medium"
                                    : "text-[#8888a0]"
                                }`}
                              >
                                {lesson.title}
                              </span>
                              {quizScore ? (
                                <span className="text-[10px] text-[#666688] tabular-nums">
                                  Score {quizScore.percent}%
                                  {quizScore.passed ? " · passed" : ""}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0">
          {active ? (
            <LessonView
              lesson={active.lesson}
              module={active.module}
              moduleAccent={active.module.accent}
              moduleTitle={active.module.title}
              moduleOrder={active.module.order}
              lessonIndex={active.index}
              lessonTotal={active.module.lessons.length}
              globalIndex={active.globalIndex}
              progress={progress}
              onToggleComplete={(complete) =>
                handleToggleComplete(active.lesson.id, complete)
              }
              onSelectLesson={persistLesson}
              onQuizSubmit={handleQuizSubmit}
            />
          ) : (
            <div className="rounded-2xl border border-[#2a2a3c] bg-[#14141f] p-8">
              <div className="text-center mb-8">
                <GraduationCap
                  size={36}
                  className="mx-auto mb-4 text-[#4ca3ff]"
                />
                <p className="text-[18px] font-semibold text-[#f0f0f5] mb-2">
                  Welcome — you know nothing about Move? Perfect.
                </p>
                <p className="text-[14px] text-[#8888a0] max-w-md mx-auto leading-relaxed">
                  This course assumes zero background. Work through{" "}
                  {MOVE_CURRICULUM.length} modules in order — lessons, recaps,
                  and quizzes. Pass each module quiz before moving on.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                {MOVE_CURRICULUM.map((mod) => (
                  <div
                    key={mod.id}
                    className="rounded-xl border border-[#2a2a3c] bg-[#1a1a26] p-4"
                  >
                    <p className="text-[10px] text-[#666688] mb-1">
                      Module {mod.order}
                    </p>
                    <p className="text-[14px] font-semibold text-[#f0f0f5] mb-1">
                      {mod.icon} {mod.title}
                    </p>
                    <p className="text-[11px] text-[#8888a0] leading-relaxed">
                      {mod.lessons.length} steps · incl. recap & quiz
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    const id = firstLessonId();
                    if (id) persistLesson(id);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#4ca3ff]/18 border border-[#4ca3ff]/40 text-[#9ed0ff] text-[14px] font-semibold cursor-pointer hover:bg-[#4ca3ff]/26"
                >
                  Start Module 1 — What are you actually writing?
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}