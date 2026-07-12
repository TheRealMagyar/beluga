import { readBelugaConfig } from "../projectManagerComponents/utils/beluga";
import { isTestableInPlayground } from "../../../helper/beluga-project";
import { loadProjects } from "../projectManagerComponents/utils/fs";
import type { PlaygroundFile } from "./types";

export type MoveParamKind =
  | "tx_context"
  | "object"
  | "u64"
  | "u32"
  | "u8"
  | "bool"
  | "address"
  | "coin"
  | "unknown";

export interface MoveEntryParam {
  name: string;
  kind: MoveParamKind;
  typeText: string;
}

export interface MoveEntryFunction {
  module: string;
  name: string;
  params: MoveEntryParam[];
  /** @deprecated Use entryNeedsObjectArg(entry) */
  needsObjectArg: boolean;
}

const getFs = () => (window as any).fs;

function languageForPath(filePath: string) {
  if (filePath.endsWith(".toml")) return "toml";
  if (filePath.endsWith(".move")) return "rust";
  return "plaintext";
}

function fileId(path: string) {
  return path.replace(/[/\\]/g, "-");
}

function extractBalancedParens(source: string, start: number): string | null {
  let depth = 1;
  let i = start;
  while (i < source.length && depth > 0) {
    if (source[i] === "(") depth++;
    else if (source[i] === ")") depth--;
    i++;
  }
  if (depth !== 0) return null;
  return source.slice(start, i - 1);
}

function splitMoveParams(paramsStr: string): string[] {
  const params: string[] = [];
  let current = "";
  let depth = 0;

  for (const ch of paramsStr) {
    if (ch === "<") depth++;
    else if (ch === ">") depth--;
    else if (ch === "," && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) params.push(trimmed);
      current = "";
      continue;
    }
    current += ch;
  }

  const trimmed = current.trim();
  if (trimmed) params.push(trimmed);
  return params;
}

function classifyMoveType(typeText: string): MoveParamKind {
  const type = typeText.replace(/\s+/g, " ").trim();
  if (/\bTxContext\b/.test(type)) return "tx_context";
  if (/\bCoin\s*</.test(type) || /\bcoin::Coin\b/.test(type)) return "coin";
  if (type === "u64") return "u64";
  if (type === "u32") return "u32";
  if (type === "u8") return "u8";
  if (type === "bool") return "bool";
  if (type === "address") return "address";
  if (/^&(?:mut\s+)?/.test(type)) return "object";
  if (/^[A-Z]\w*/.test(type)) return "object";
  return "unknown";
}

function parseMoveParam(raw: string): MoveEntryParam | null {
  const match = raw.trim().match(/^(\w+)\s*:\s*(.+)$/);
  if (!match) return null;
  const [, name, typeText] = match;
  return {
    name,
    typeText: typeText.trim(),
    kind: classifyMoveType(typeText.trim()),
  };
}

export async function listTestableProjects(): Promise<TestableProject[]> {
  const projects = await loadProjects();
  const testable: TestableProject[] = [];

  for (const project of projects) {
    const config = await readBelugaConfig(project.path, project.name);
    if (config && isTestableInPlayground(config.template)) {
      testable.push({
        name: project.name,
        path: project.path,
        template: config.template,
      });
      continue;
    }

    const fs = getFs();
    const moveTomlPath = await fs.pathJoin(project.path, "Move.toml");
    const moveToml = await fs.readFile(moveTomlPath);
    if (moveToml) {
      testable.push({
        name: project.name,
        path: project.path,
        template: "move",
      });
    }
  }

  return testable;
}

async function collectSourceFiles(
  dirPath: string,
  relativePrefix: string,
): Promise<Array<{ path: string; content: string }>> {
  const fs = getFs();
  const entries = await fs.readdir(dirPath);
  const files: Array<{ path: string; content: string }> = [];

  for (const entry of entries) {
    const entryPath = await fs.pathJoin(dirPath, entry);
    const stat = await fs.stat(entryPath);
    const relativePath = `${relativePrefix}/${entry}`;

    if (stat.isDirectory) {
      const nested = await collectSourceFiles(entryPath, relativePath);
      files.push(...nested);
    } else if (entry.endsWith(".move")) {
      const content = await fs.readFile(entryPath);
      if (content != null) {
        files.push({ path: relativePath, content });
      }
    }
  }

  return files;
}

export function parsePackageName(moveToml: string): string | null {
  const match = moveToml.match(/^\s*name\s*=\s*"([^"]+)"/m);
  return match?.[1] ?? null;
}

export function parseMoveEntryFunctions(
  moveSources: string[],
  fallbackModule: string,
): MoveEntryFunction[] {
  const entries: MoveEntryFunction[] = [];
  const entryHeader = /(?:public\s+)?entry\s+fun\s+(\w+)\s*\(/g;

  for (const source of moveSources) {
    const moduleMatch = source.match(/module\s+\w+::(\w+)/);
    const moduleName = moduleMatch?.[1] ?? fallbackModule;

    let match: RegExpExecArray | null;
    while ((match = entryHeader.exec(source)) !== null) {
      const name = match[1];
      const paramsStart = match.index + match[0].length;
      const paramsStr = extractBalancedParens(source, paramsStart);
      if (paramsStr == null) continue;

      const params = splitMoveParams(paramsStr)
        .map(parseMoveParam)
        .filter((param): param is MoveEntryParam => param != null);

      entries.push({
        module: moduleName,
        name,
        params,
        needsObjectArg: params.some((param) => param.kind === "object"),
      });
    }
  }

  return entries;
}

export async function loadProjectIntoPlayground(
  projectPath: string,
): Promise<{
  files: PlaygroundFile[];
  packageName: string;
  entries: MoveEntryFunction[];
}> {
  const fs = getFs();
  const rawFiles: Array<{ path: string; content: string }> = [];

  const moveTomlPath = await fs.pathJoin(projectPath, "Move.toml");
  const moveToml = await fs.readFile(moveTomlPath);
  if (moveToml) {
    rawFiles.push({ path: "Move.toml", content: moveToml });
  }

  const sourcesPath = await fs.pathJoin(projectPath, "sources");
  try {
    const sourcesStat = await fs.stat(sourcesPath);
    if (sourcesStat.isDirectory) {
      rawFiles.push(...(await collectSourceFiles(sourcesPath, "sources")));
    }
  } catch {
    // sources folder may be missing
  }

  if (!rawFiles.length) {
    throw new Error("No Move.toml or .move files found in this project.");
  }

  const moveTomlContent =
    rawFiles.find((f) => f.path === "Move.toml")?.content ?? "";
  const packageName = parsePackageName(moveTomlContent) ?? "package";
  const moveSources = rawFiles
    .filter((f) => f.path.endsWith(".move"))
    .map((f) => f.content);

  const files: PlaygroundFile[] = rawFiles.map((file) => ({
    id: fileId(file.path),
    name: file.path.split("/").pop() ?? file.path,
    path: file.path,
    language: languageForPath(file.path),
    content: file.content,
  }));

  return {
    files,
    packageName,
    entries: parseMoveEntryFunctions(moveSources, packageName),
  };
}

export interface TestableProject {
  name: string;
  path: string;
  template: string;
}