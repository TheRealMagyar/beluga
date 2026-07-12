import type { MoveLesson, MoveModule } from "./types";
import { MODULE_START } from "./m01-start";
import { MODULE_VARIABLES } from "./m02-variables";
import { MODULE_FUNCTIONS } from "./m03-functions";
import { MODULE_CONTROL } from "./m04-control";
import { MODULE_STRUCTS } from "./m05-structs";
import { MODULE_OWNERSHIP } from "./m06-ownership";
import { MODULE_OBJECTS } from "./m07-objects";
import { MODULE_CAPSTONE } from "./m08-capstone";
import { MODULE_IMPORTS } from "./m09-imports";
import { MODULE_EVENTS } from "./m10-events-errors";
import { MODULE_CAPABILITIES } from "./m11-capabilities";
import { MODULE_TOKENS } from "./m12-tokens-nft";
import { MODULE_ADVANCED } from "./m13-advanced-sui";
import { enrichCurriculum } from "./enrich-modules";

export type {
  LessonBlock,
  LessonKind,
  MoveLesson,
  MoveModule,
  Quiz,
  QuizQuestion,
} from "./types";

const RAW_CURRICULUM: MoveModule[] = [
  MODULE_START,
  MODULE_VARIABLES,
  MODULE_FUNCTIONS,
  MODULE_CONTROL,
  MODULE_STRUCTS,
  MODULE_OWNERSHIP,
  MODULE_OBJECTS,
  MODULE_IMPORTS,
  MODULE_EVENTS,
  MODULE_CAPABILITIES,
  MODULE_TOKENS,
  MODULE_ADVANCED,
  MODULE_CAPSTONE,
];

export const MOVE_CURRICULUM: MoveModule[] = enrichCurriculum(RAW_CURRICULUM);

export const ALL_LESSON_IDS = MOVE_CURRICULUM.flatMap((mod) =>
  mod.lessons.map((lesson) => lesson.id),
);

export const TOTAL_LESSONS = ALL_LESSON_IDS.length;

export function findLesson(lessonId: string): {
  module: MoveModule;
  lesson: MoveLesson;
  index: number;
  globalIndex: number;
} | null {
  let global = 0;
  for (const mod of MOVE_CURRICULUM) {
    const index = mod.lessons.findIndex((l) => l.id === lessonId);
    if (index >= 0) {
      return {
        module: mod,
        lesson: mod.lessons[index],
        index,
        globalIndex: global + index,
      };
    }
    global += mod.lessons.length;
  }
  return null;
}

export function adjacentLesson(lessonId: string): {
  prev: string | null;
  next: string | null;
} {
  const ids = MOVE_CURRICULUM.flatMap((mod) =>
    mod.lessons.map((l) => l.id),
  );
  const idx = ids.findIndex((id) => id === lessonId);
  if (idx < 0) return { prev: null, next: null };
  return {
    prev: idx > 0 ? ids[idx - 1] : null,
    next: idx < ids.length - 1 ? ids[idx + 1] : null,
  };
}

export function firstLessonId(): string | null {
  return MOVE_CURRICULUM[0]?.lessons[0]?.id ?? null;
}