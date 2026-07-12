import type { ProjectTemplateId } from "./project-templates";

export const BELUGA_JSON = "beluga.json";

export const LEGACY_MEMORIES_FILE = ".memories.json";
export const LEGACY_PACKAGES_FILE = ".packages.json";
export const LEGACY_PROJECT_FILE = ".beluga-project.json";

export interface BelugaProjectGitHubLink {
  owner: string;
  repo: string;
  defaultBranch?: string;
  htmlUrl?: string;
  private?: boolean;
}

export interface BelugaProjectConfig {
  version: 1;
  name: string;
  template: ProjectTemplateId;
  createdAt: string;
  memories: string[];
  packages: string[];
  skills: string[];
  github?: BelugaProjectGitHubLink;
}

export function createBelugaConfig(
  name: string,
  template: ProjectTemplateId,
  overrides: Partial<Pick<BelugaProjectConfig, "memories" | "packages" | "skills">> = {},
): BelugaProjectConfig {
  return {
    version: 1,
    name,
    template,
    createdAt: new Date().toISOString(),
    memories: overrides.memories ?? [],
    packages: overrides.packages ?? [],
    skills: overrides.skills ?? [],
  };
}

export function isTestableInPlayground(
  template: ProjectTemplateId,
): boolean {
  return template === "move";
}