import type { SuiNetwork } from "../../types/network";

export type PlaygroundNetwork = SuiNetwork;

export interface PlaygroundFile {
  id: string;
  name: string;
  path: string;
  language: string;
  content: string;
}

export interface PlaygroundCliStatus {
  installed: boolean;
  version: string | null;
  path: string | null;
}

export interface PlaygroundBuildResult {
  modules: string[];
  dependencies: string[];
  digest: number[];
  stdout: string;
  stderr: string;
}

export interface PlaygroundDeployment {
  packageId: string;
  digest: string;
  network: PlaygroundNetwork;
  publishedAt: number;
  packageName?: string;
  modules?: string[];
  moduleTargets?: string[];
  entryTargets?: string[];
  upgradeCapId?: string | null;
}

export type LogLevel = "info" | "success" | "error" | "warn";

export interface ConsoleLog {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: number;
}