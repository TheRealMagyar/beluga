import { readBelugaConfig } from "../projectManagerComponents/utils/beluga";
import { isTestableInPlayground } from "../../../helper/beluga-project";
import { getProjectScaffold } from "../../../helper/project-templates";
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
  | "string"
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
  if (/\bString\b/.test(type) || /vector\s*<\s*u8\s*>/.test(type)) return "string";
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

async function pathIsFile(filePath: string): Promise<boolean> {
  const fs = getFs();
  try {
    const stat = await fs.stat(filePath);
    return stat != null && !stat.isDirectory;
  } catch {
    return false;
  }
}

/** Resolve the directory that contains Move.toml (project root or one subfolder deep). */
export async function findMovePackageRoot(
  projectPath: string,
): Promise<string | null> {
  const fs = getFs();
  const candidates = [projectPath];

  try {
    const entries = await fs.readdir(projectPath);
    for (const entry of entries) {
      const subPath = await fs.pathJoin(projectPath, entry);
      try {
        const stat = await fs.stat(subPath);
        if (stat?.isDirectory) candidates.push(subPath);
      } catch {
        // skip unreadable entries
      }
    }
  } catch {
    return null;
  }

  for (const root of candidates) {
    const moveTomlPath = await fs.pathJoin(root, "Move.toml");
    if (await pathIsFile(moveTomlPath)) return root;
  }

  return null;
}

function scaffoldMoveFiles(packageName: string) {
  return getProjectScaffold("move", packageName).filter(
    (file) => file.path === "Move.toml" || file.path.startsWith("sources/"),
  );
}

async function repairMoveScaffold(
  projectPath: string,
  projectName: string,
): Promise<Array<{ path: string; content: string }> | null> {
  const config = await readBelugaConfig(projectPath, projectName);
  if (!config || !isTestableInPlayground(config.template)) return null;

  const packageName = config.name || projectName;
  return scaffoldMoveFiles(packageName).map((file) => ({
    path: file.path,
    content:
      typeof file.content === "function" ? file.content(packageName) : file.content,
  }));
}

async function persistRepairedFiles(
  packageRoot: string,
  files: Array<{ path: string; content: string }>,
) {
  const fs = getFs();
  for (const file of files) {
    const target = await fs.pathJoin(packageRoot, file.path);
    const existing = await fs.readFile(target);
    if (existing !== null && existing.trim().length > 0) continue;

    const parts = file.path.split("/");
    if (parts.length > 1) {
      const parent = await fs.pathJoin(packageRoot, ...parts.slice(0, -1));
      await fs.mkdir(parent);
    }
    await fs.writeFile(target, file.content);
  }
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

    if (await findMovePackageRoot(project.path)) {
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
    if (!stat) continue;
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

/** Count callable `public fun` that are not `entry fun` (for Playground hints). */
export function countMovePublicFunctions(moveSources: string[]): number {
  let count = 0;
  const publicHeader = /public\s+fun\s+(\w+)\s*\(/g;
  const entryHeader = /(?:public\s+)?entry\s+fun\s+/g;

  for (const source of moveSources) {
    const withoutEntries = source.replace(entryHeader, "/*entry*/ fun ");
    let match: RegExpExecArray | null;
    while ((match = publicHeader.exec(withoutEntries)) !== null) {
      count++;
    }
  }

  return count;
}

export async function loadProjectIntoPlayground(
  projectPath: string,
): Promise<{
  files: PlaygroundFile[];
  packageName: string;
  entries: MoveEntryFunction[];
}> {
  const fs = getFs();
  const projectName = projectPath.split(/[/\\]/).pop() ?? "project";
  const packageRoot = (await findMovePackageRoot(projectPath)) ?? projectPath;
  const rawFiles: Array<{ path: string; content: string }> = [];

  const moveTomlPath = await fs.pathJoin(packageRoot, "Move.toml");
  const moveTomlExists = await pathIsFile(moveTomlPath);
  let moveToml = moveTomlExists ? await fs.readFile(moveTomlPath) : null;

  if (moveTomlExists) {
    if (moveToml === null) moveToml = "";
    if (!moveToml.trim()) {
      const repaired = await repairMoveScaffold(projectPath, projectName);
      const replacement = repaired?.find((f) => f.path === "Move.toml");
      if (replacement) {
        moveToml = replacement.content;
        await persistRepairedFiles(packageRoot, [replacement]);
      }
    }
    rawFiles.push({ path: "Move.toml", content: moveToml ?? "" });
  } else {
    const repaired = await repairMoveScaffold(projectPath, projectName);
    const replacement = repaired?.find((f) => f.path === "Move.toml");
    if (replacement) {
      rawFiles.push(replacement);
      await persistRepairedFiles(packageRoot, [replacement]);
    }
  }

  const sourcesPath = await fs.pathJoin(packageRoot, "sources");
  try {
    const sourcesStat = await fs.stat(sourcesPath);
    if (sourcesStat?.isDirectory) {
      rawFiles.push(...(await collectSourceFiles(sourcesPath, "sources")));
    }
  } catch {
    // sources folder may be missing
  }

  const moveSourcesEmpty =
    !rawFiles.some((f) => f.path.endsWith(".move") && f.content.trim().length > 0);
  if (moveSourcesEmpty) {
    const repaired = await repairMoveScaffold(projectPath, projectName);
    if (repaired) {
      const sourceFiles = repaired.filter((f) => f.path.startsWith("sources/"));
      if (sourceFiles.length) {
        rawFiles.push(...sourceFiles);
        await persistRepairedFiles(packageRoot, sourceFiles);
      }
    }
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